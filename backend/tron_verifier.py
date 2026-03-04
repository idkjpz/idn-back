"""
Sistema de verificación de transacciones USDT TRC20
Verifica pagos automáticamente consultando la blockchain de Tron
"""
import requests
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# USDT TRC20 Contract Address (dirección oficial de Tether en Tron)
USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"

class TronVerifier:
    """Verifica transacciones USDT en la red TRC20"""
    
    def __init__(self, wallet_address: str):
        """
        Args:
            wallet_address: Tu wallet de Tron (formato base58)
        """
        self.wallet_address = wallet_address
        self.api_base = "https://api.trongrid.io"
        
    def verify_transaction(self, tx_hash: str, expected_amount: float) -> Tuple[bool, str, Dict]:
        """
        Verifica una transacción USDT TRC20
        
        Args:
            tx_hash: Hash de la transacción
            expected_amount: Monto esperado en USDT
            
        Returns:
            Tuple[bool, str, Dict]: (éxito, mensaje, detalles)
        """
        try:
            # 1. Obtener información de la transacción
            tx_info = self._get_transaction_info(tx_hash)
            if not tx_info:
                return False, "❌ Transacción no encontrada", {}
            
            # 2. Verificar que la transacción esté confirmada
            if not tx_info.get('confirmed', False):
                return False, "⏳ Transacción pendiente de confirmación", tx_info
            
            # 3. Extraer detalles de la transacción
            details = self._parse_transaction(tx_info)
            
            # 4. Verificaciones de seguridad
            
            # Verificar que es una transferencia de USDT
            if details['contract'].upper() != USDT_CONTRACT.upper():
                return False, f"❌ No es una transacción USDT. Token: {details['contract']}", details
            
            # Verificar que la wallet destino es la correcta
            if details['to_address'].upper() != self.wallet_address.upper():
                return False, f"❌ Wallet destino incorrecta. Enviado a: {details['to_address']}", details
            
            # Verificar el monto
            amount = details['amount']
            tolerance = 0.01  # Tolerancia de 0.01 USDT por decimales
            if abs(amount - expected_amount) > tolerance:
                return False, f"❌ Monto incorrecto. Esperado: {expected_amount} USDT, Recibido: {amount} USDT", details
            
            # Verificar confirmaciones (al menos 19 confirmaciones para seguridad)
            if details['confirmations'] < 19:
                return False, f"⏳ Esperando más confirmaciones ({details['confirmations']}/19)", details
            
            # ✅ Todas las verificaciones pasaron
            return True, "✅ Pago verificado correctamente", details
            
        except Exception as e:
            logger.error(f"Error verificando transacción {tx_hash}: {e}")
            return False, f"❌ Error al verificar: {str(e)}", {}
    
    def _get_transaction_info(self, tx_hash: str) -> Optional[Dict]:
        """Obtiene información de una transacción desde TronGrid API"""
        try:
            url = f"{self.api_base}/v1/transactions/{tx_hash}"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('data'):
                    return data['data'][0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error consultando TronGrid: {e}")
            return None
    
    def _parse_transaction(self, tx_info: Dict) -> Dict:
        """Extrae información relevante de la transacción"""
        details = {
            'hash': tx_info.get('txID', ''),
            'block': tx_info.get('blockNumber', 0),
            'timestamp': tx_info.get('block_timestamp', 0),
            'confirmed': tx_info.get('ret', [{}])[0].get('contractRet') == 'SUCCESS',
            'from_address': '',
            'to_address': '',
            'amount': 0.0,
            'contract': '',
            'confirmations': 0
        }
        
        # Extraer información del contrato
        try:
            contract = tx_info.get('raw_data', {}).get('contract', [{}])[0]
            parameter = contract.get('parameter', {}).get('value', {})
            
            # Para transacciones TRC20
            if contract.get('type') == 'TriggerSmartContract':
                details['contract'] = parameter.get('contract_address', '')
                
                # Decodificar data (formato hex)
                data = parameter.get('data', '')
                if len(data) >= 136:  # transfer(address,uint256)
                    # Los primeros 8 caracteres son el método (a9059cbb = transfer)
                    # Los siguientes 64 son la dirección destino
                    # Los últimos 64 son el monto en hex
                    to_hex = data[32:72]
                    amount_hex = data[72:136]
                    
                    # Convertir dirección hex a base58
                    details['to_address'] = self._hex_to_base58(to_hex)
                    
                    # Convertir monto (6 decimales para USDT)
                    amount_value = int(amount_hex, 16) if amount_hex else 0
                    details['amount'] = amount_value / 1_000_000  # USDT tiene 6 decimales
            
            # Owner address (from)
            details['from_address'] = parameter.get('owner_address', '')
            
            # Calcular confirmaciones aproximadas (bloques desde la transacción)
            current_block = self._get_current_block()
            if current_block:
                details['confirmations'] = current_block - details['block']
            
        except Exception as e:
            logger.error(f"Error parseando transacción: {e}")
        
        return details
    
    def _hex_to_base58(self, hex_address: str) -> str:
        """Convierte dirección hex a base58 (formato Tron)"""
        try:
            # Agregar prefijo 41 para mainnet
            full_hex = '41' + hex_address
            # Convertir a base58 usando la API de TronGrid
            url = f"{self.api_base}/wallet/hexaddress/{full_hex}"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                return response.json().get('base58_address', '')
        except:
            pass
        return hex_address
    
    def _get_current_block(self) -> Optional[int]:
        """Obtiene el bloque actual de la red"""
        try:
            url = f"{self.api_base}/wallet/getnowblock"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                return response.json().get('block_header', {}).get('raw_data', {}).get('number', 0)
        except:
            pass
        return None


def verify_usdt_payment(tx_hash: str, wallet_address: str, expected_amount: float) -> Tuple[bool, str, Dict]:
    """
    Función auxiliar para verificar un pago USDT TRC20
    
    Args:
        tx_hash: Hash de la transacción
        wallet_address: Tu wallet de Tron
        expected_amount: Monto esperado en USDT
        
    Returns:
        Tuple[bool, str, Dict]: (éxito, mensaje, detalles)
    """
    verifier = TronVerifier(wallet_address)
    return verifier.verify_transaction(tx_hash, expected_amount)
