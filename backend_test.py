import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class IDNBackofficeAPITester:
    def __init__(self, base_url="https://gymbot-telegram.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_resources = {
            'products': [],
            'conversations': [],
            'bot_messages': []
        }

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {name}")
        if details:
            print(f"   Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}, Expected: {expected_status}"
            
            if not success:
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"
            
            self.log_test(name, success, details)
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API Endpoint", "GET", "", 200)

    def test_products_crud(self):
        """Test complete Products CRUD operations"""
        print("\n🔍 Testing Products API...")
        
        # Test GET products (should work even if empty)
        success, products = self.run_test("Get All Products", "GET", "products", 200)
        if not success:
            return False
        
        # Test CREATE product with Orales category
        test_product_orales = {
            "nombre": "Creatina Monohidrato Test",
            "descripcion": "Suplemento de creatina para aumento de fuerza y masa muscular",
            "imagen_url": "https://via.placeholder.com/300x300/4CAF50/FFFFFF?text=Creatina",
            "precio_minorista": 45.99,
            "precio_mayorista": 35.99,
            "stock": 50,
            "categoria": "Orales",
            "activo": True
        }
        
        success, created_product = self.run_test("Create Product (Orales)", "POST", "products", 200, test_product_orales)
        if not success:
            return False
        
        product_id = created_product.get('id')
        if not product_id:
            self.log_test("Product Creation - ID Check", False, "No ID returned in created product")
            return False
        
        self.created_resources['products'].append(product_id)
        
        # Test CREATE product with Inyectables category
        test_product_inyectables = {
            "nombre": "Testosterona Enantato Test",
            "descripcion": "Esteroide anabólico inyectable para desarrollo muscular",
            "imagen_url": "https://via.placeholder.com/300x300/2196F3/FFFFFF?text=Testosterona",
            "precio_minorista": 85.99,
            "precio_mayorista": 70.99,
            "stock": 25,
            "categoria": "Inyectables",
            "activo": True
        }
        
        success, created_product2 = self.run_test("Create Product (Inyectables)", "POST", "products", 200, test_product_inyectables)
        if not success:
            return False
        
        product_id2 = created_product2.get('id')
        if product_id2:
            self.created_resources['products'].append(product_id2)
        
        # Test GET single product
        success, single_product = self.run_test("Get Single Product", "GET", f"products/{product_id}", 200)
        if not success:
            return False
        
        # Validate product structure
        required_fields = ['id', 'nombre', 'descripcion', 'precio_minorista', 'precio_mayorista', 'stock', 'categoria']
        missing_fields = [field for field in required_fields if field not in single_product]
        if missing_fields:
            self.log_test("Product Structure Validation", False, f"Missing fields: {missing_fields}")
            return False
        else:
            self.log_test("Product Structure Validation", True, "All required fields present")
        
        # Test UPDATE product
        update_data = {
            "nombre": "Creatina Monohidrato Test Actualizada",
            "precio_minorista": 50.99,
            "stock": 75
        }
        success, updated_product = self.run_test("Update Product", "PUT", f"products/{product_id}", 200, update_data)
        if not success:
            return False
        
        # Verify update worked
        if updated_product.get('nombre') != update_data['nombre']:
            self.log_test("Product Update Verification", False, "Product name not updated correctly")
            return False
        else:
            self.log_test("Product Update Verification", True, "Product updated correctly")
        
        return True

    def test_orders_api(self):
        """Test Orders API operations"""
        print("\n🔍 Testing Orders API...")
        
        # Test GET orders
        success, orders = self.run_test("Get All Orders", "GET", "orders", 200)
        if not success:
            return False
        
        # If there are orders, test getting a single order and updating status
        if orders and len(orders) > 0:
            order_id = orders[0].get('id')
            if order_id:
                # Test GET single order
                success, single_order = self.run_test("Get Single Order", "GET", f"orders/{order_id}", 200)
                if not success:
                    return False
                
                # Validate order structure
                required_fields = ['id', 'chat_id', 'productos', 'total', 'tipo_lista', 'metodo_pago', 'estado']
                missing_fields = [field for field in required_fields if field not in single_order]
                if missing_fields:
                    self.log_test("Order Structure Validation", False, f"Missing fields: {missing_fields}")
                    return False
                else:
                    self.log_test("Order Structure Validation", True, "All required fields present")
                
                # Test UPDATE order status - test all valid states
                valid_states = ["pendiente", "confirmado", "en_preparacion", "entregado", "spam"]
                original_state = single_order.get('estado', 'pendiente')
                
                for state in valid_states:
                    if state != original_state:
                        status_update = {"estado": state}
                        success, updated_order = self.run_test(f"Update Order Status to {state}", "PUT", f"orders/{order_id}/status", 200, status_update)
                        if not success:
                            return False
                        
                        # Verify status was updated
                        if updated_order.get('estado') != state:
                            self.log_test(f"Order Status Update Verification ({state})", False, f"Status not updated to {state}")
                            return False
                        else:
                            self.log_test(f"Order Status Update Verification ({state})", True, f"Status correctly updated to {state}")
                        break
        else:
            self.log_test("Orders API - No Orders", True, "No orders found to test individual operations")
        
        return True

    def test_statistics_api(self):
        """Test Statistics API"""
        print("\n🔍 Testing Statistics API...")
        
        success, stats = self.run_test("Get Statistics", "GET", "stats", 200)
        if not success:
            return False
        
        # Validate statistics structure
        required_fields = ['total_orders', 'orders_by_status', 'total_ventas', 'ventas_por_tipo', 'top_productos', 'low_stock_products']
        missing_fields = [field for field in required_fields if field not in stats]
        
        if missing_fields:
            self.log_test("Statistics Structure", False, f"Missing fields: {missing_fields}")
            return False
        else:
            self.log_test("Statistics Structure", True, "All required fields present")
        
        return True

    def test_bot_configuration_api(self):
        """Test Bot Configuration APIs"""
        print("\n🔍 Testing Bot Configuration API...")
        
        # Test Bot Status
        success, bot_status = self.run_test("Get Bot Status", "GET", "bot-status", 200)
        if not success:
            return False
        
        if 'enabled' not in bot_status:
            self.log_test("Bot Status Structure", False, "Missing 'enabled' field")
            return False
        else:
            self.log_test("Bot Status Structure", True, "Bot status structure valid")
        
        # Test Update Bot Status
        new_status = {"enabled": not bot_status['enabled']}
        success, _ = self.run_test("Update Bot Status", "PUT", "bot-status", 200, new_status)
        if not success:
            return False
        
        # Test TRON Wallet Configuration
        success, wallet_config = self.run_test("Get TRON Wallet", "GET", "tron-wallet", 200)
        if not success:
            return False
        
        if 'wallet' not in wallet_config:
            self.log_test("TRON Wallet Structure", False, "Missing 'wallet' field")
            return False
        else:
            self.log_test("TRON Wallet Structure", True, "TRON wallet structure valid")
        
        # Test Update TRON Wallet (use valid 34-character format)
        test_wallet = {"wallet": "TTestWalletAddress123456789ABCDEF1"}
        success, _ = self.run_test("Update TRON Wallet", "PUT", "tron-wallet", 200, test_wallet)
        if not success:
            return False
        
        # Test WhatsApp Configuration
        success, whatsapp_config = self.run_test("Get WhatsApp Config", "GET", "whatsapp-config", 200)
        if not success:
            return False
        
        if 'number' not in whatsapp_config:
            self.log_test("WhatsApp Config Structure", False, "Missing 'number' field")
            return False
        else:
            self.log_test("WhatsApp Config Structure", True, "WhatsApp config structure valid")
        
        # Test Update WhatsApp Configuration
        test_whatsapp = {"number": "5491123456789"}
        success, _ = self.run_test("Update WhatsApp Config", "PUT", "whatsapp-config", 200, test_whatsapp)
        if not success:
            return False
        
        # Test Telegram Support Configuration
        success, telegram_config = self.run_test("Get Telegram Support Config", "GET", "telegram-support-config", 200)
        if not success:
            return False
        
        if 'username' not in telegram_config:
            self.log_test("Telegram Support Structure", False, "Missing 'username' field")
            return False
        else:
            self.log_test("Telegram Support Structure", True, "Telegram support structure valid")
        
        # Test Update Telegram Support Configuration
        test_telegram = {"username": "test_support_user"}
        success, _ = self.run_test("Update Telegram Support Config", "PUT", "telegram-support-config", 200, test_telegram)
        if not success:
            return False
        
        return True

    def test_bot_messages_api(self):
        """Test Bot Messages API"""
        print("\n🔍 Testing Bot Messages API...")
        
        # Test GET bot messages
        success, messages = self.run_test("Get Bot Messages", "GET", "bot-messages", 200)
        if not success:
            return False
        
        # Test CREATE bot message
        test_message = {
            "key": f"test_message_{uuid.uuid4().hex[:8]}",
            "titulo": "Mensaje de Prueba API",
            "mensaje": "Este es un mensaje de prueba creado por la API de testing",
            "activo": True
        }
        
        success, created_message = self.run_test("Create Bot Message", "POST", "bot-messages", 200, test_message)
        if not success:
            return False
        
        message_id = created_message.get('id')
        if not message_id:
            self.log_test("Bot Message Creation - ID Check", False, "No ID returned in created message")
            return False
        
        self.created_resources['bot_messages'].append(message_id)
        
        # Test GET single bot message
        success, single_message = self.run_test("Get Single Bot Message", "GET", f"bot-messages/{message_id}", 200)
        if not success:
            return False
        
        # Validate message structure
        required_fields = ['id', 'key', 'titulo', 'mensaje', 'activo']
        missing_fields = [field for field in required_fields if field not in single_message]
        if missing_fields:
            self.log_test("Bot Message Structure", False, f"Missing fields: {missing_fields}")
            return False
        else:
            self.log_test("Bot Message Structure", True, "All required fields present")
        
        # Test UPDATE bot message
        update_data = {
            "titulo": "Mensaje de Prueba API Actualizado",
            "mensaje": "Mensaje actualizado por la API de testing",
            "activo": False
        }
        success, _ = self.run_test("Update Bot Message", "PUT", f"bot-messages/{message_id}", 200, update_data)
        if not success:
            return False
        
        return True

    def test_live_chat_api(self):
        """Test Live Chat API"""
        print("\n🔍 Testing Live Chat API...")
        
        # Test GET conversations
        success, conversations = self.run_test("Get Conversations", "GET", "conversations", 200)
        if not success:
            return False
        
        # If there are conversations, test conversation operations
        if conversations and len(conversations) > 0:
            conversation_id = conversations[0].get('id')
            if conversation_id:
                # Test GET conversation messages
                success, messages = self.run_test("Get Conversation Messages", "GET", f"conversations/{conversation_id}/messages", 200)
                if not success:
                    return False
                
                # Test SEND message to client
                test_message = {
                    "message": "Mensaje de prueba desde el backoffice para testing de API"
                }
                success, _ = self.run_test("Send Message to Client", "POST", f"conversations/{conversation_id}/messages", 200, test_message)
                if not success:
                    return False
                
                # Test MARK conversation as read
                success, _ = self.run_test("Mark Conversation Read", "PUT", f"conversations/{conversation_id}/mark-read", 200)
                if not success:
                    return False
        else:
            self.log_test("Live Chat API - No Conversations", True, "No conversations found to test operations")
        
        return True

    def test_bot_interactions_api(self):
        """Test Bot Interactions API"""
        print("\n🔍 Testing Bot Interactions API...")
        
        # Test GET bot interactions without filters
        success, interactions = self.run_test("Get Bot Interactions", "GET", "bot-interactions", 200)
        if not success:
            return False
        
        # Validate interactions structure
        required_fields = ['total_interactions', 'unique_users', 'by_date', 'interactions']
        missing_fields = [field for field in interactions if field not in interactions]
        if any(field not in interactions for field in required_fields):
            missing = [field for field in required_fields if field not in interactions]
            self.log_test("Bot Interactions Structure", False, f"Missing fields: {missing}")
            return False
        else:
            self.log_test("Bot Interactions Structure", True, "All required fields present")
        
        # Test GET bot interactions with date filters
        today = datetime.now().strftime("%Y-%m-%d")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        success, filtered_interactions = self.run_test("Get Bot Interactions (Filtered)", "GET", f"bot-interactions?start_date={yesterday}&end_date={today}", 200)
        if not success:
            return False
        
        return True

    def test_error_handling(self):
        """Test API error handling"""
        print("\n🔍 Testing Error Handling...")
        
        # Test 404 for non-existent product
        success, _ = self.run_test("Product Not Found", "GET", "products/non-existent-id", 404)
        if not success:
            return False
        
        # Test 404 for non-existent order
        success, _ = self.run_test("Order Not Found", "GET", "orders/non-existent-id", 404)
        if not success:
            return False
        
        # Test 404 for non-existent bot message
        success, _ = self.run_test("Bot Message Not Found", "GET", "bot-messages/non-existent-id", 404)
        if not success:
            return False
        
        # Test 404 for non-existent conversation
        success, _ = self.run_test("Conversation Not Found", "GET", "conversations/non-existent-id/messages", 404)
        if not success:
            return False
        
        # Test 400 for invalid TRON wallet
        invalid_wallet = {"wallet": "invalid-wallet-format"}
        success, _ = self.run_test("Invalid TRON Wallet", "PUT", "tron-wallet", 400, invalid_wallet)
        if not success:
            return False
        
        # Test 400 for empty WhatsApp number
        empty_whatsapp = {"number": ""}
        success, _ = self.run_test("Empty WhatsApp Number", "PUT", "whatsapp-config", 400, empty_whatsapp)
        if not success:
            return False
        
        # Test 400 for empty Telegram username
        empty_telegram = {"username": ""}
        success, _ = self.run_test("Empty Telegram Username", "PUT", "telegram-support-config", 400, empty_telegram)
        if not success:
            return False
        
        return True

    def cleanup_test_resources(self):
        """Clean up resources created during testing"""
        print("\n🧹 Cleaning up test resources...")
        
        # Delete test products
        for product_id in self.created_resources['products']:
            success, _ = self.run_test(f"Cleanup Product {product_id}", "DELETE", f"products/{product_id}", 200)
            if success:
                self.log_test(f"Cleanup Product {product_id}", True, "Test product cleaned up")
        
        # Note: We don't clean up bot messages as they might be useful to keep
        # and the API doesn't provide a delete endpoint for them
        
        return True

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting IDN Backoffice API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 70)
        
        # Test basic connectivity
        success, _ = self.test_root_endpoint()
        if not success:
            print("❌ Basic connectivity failed, stopping tests")
            return False
        
        # Run all test suites in priority order
        test_suites = [
            # P0 - Critical Tests
            ("Products CRUD (P0)", self.test_products_crud),
            ("Orders API (P0)", self.test_orders_api),
            ("Bot Configuration (P0)", self.test_bot_configuration_api),
            ("Bot Messages (P0)", self.test_bot_messages_api),
            
            # P1 - Important Tests
            ("Statistics API (P1)", self.test_statistics_api),
            ("Live Chat API (P1)", self.test_live_chat_api),
            ("Bot Interactions (P1)", self.test_bot_interactions_api),
            
            # Error Handling
            ("Error Handling", self.test_error_handling)
        ]
        
        all_passed = True
        failed_suites = []
        
        for suite_name, test_suite in test_suites:
            print(f"\n{'='*20} {suite_name} {'='*20}")
            if not test_suite():
                all_passed = False
                failed_suites.append(suite_name)
        
        # Cleanup test resources
        self.cleanup_test_resources()
        
        # Print detailed summary
        print("\n" + "=" * 70)
        print(f"📊 FINAL TEST SUMMARY")
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%" if self.tests_run > 0 else "0%")
        
        if all_passed:
            print("\n🎉 ALL API TESTS PASSED!")
            print("✅ IDN Backoffice backend is working correctly")
        else:
            print(f"\n⚠️  {len(failed_suites)} TEST SUITE(S) FAILED:")
            for suite in failed_suites:
                print(f"   ❌ {suite}")
            print("\n🔍 Check detailed results above for specific failures")
        
        return all_passed

def main():
    tester = IDNBackofficeAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'failed_tests': tester.tests_run - tester.tests_passed,
                'success_rate': (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
                'timestamp': datetime.now().isoformat(),
                'test_url': tester.base_url
            },
            'detailed_results': tester.test_results,
            'created_resources': tester.created_resources
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/backend_test_results.json")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())