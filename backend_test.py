#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for AOSP ROM Builder
Tests all backend endpoints except the build start endpoint
"""

import requests
import json
import time
import sys
from typing import Dict, Any

# Backend URL from environment
BACKEND_URL = "https://aosp-android16-k10.preview.emergentagent.com/api"

class AOSPBackendTester:
    def __init__(self):
        self.results = []
        self.failed_tests = []
        
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        }
        self.results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    Details: {details}")
        if not success:
            self.failed_tests.append(test_name)
        print()
    
    def test_health_endpoint(self):
        """Test GET /api/health"""
        try:
            response = requests.get(f"{BACKEND_URL}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "status" in data and "service" in data:
                    self.log_result("Health Check", True, 
                                  f"Status: {data.get('status')}, Service: {data.get('service')}", data)
                else:
                    self.log_result("Health Check", False, 
                                  f"Missing required fields in response: {data}", data)
            else:
                self.log_result("Health Check", False, 
                              f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Health Check", False, f"Exception: {str(e)}")
    
    def test_system_check_endpoint(self):
        """Test GET /api/system/check"""
        try:
            response = requests.get(f"{BACKEND_URL}/system/check", timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["installed", "missing", "system_ready"]
                
                if all(field in data for field in required_fields):
                    installed_count = len(data.get("installed", []))
                    missing_count = len(data.get("missing", []))
                    system_ready = data.get("system_ready", False)
                    
                    self.log_result("System Dependency Check", True,
                                  f"Installed: {installed_count}, Missing: {missing_count}, Ready: {system_ready}", 
                                  data)
                else:
                    self.log_result("System Dependency Check", False,
                                  f"Missing required fields. Got: {list(data.keys())}", data)
            else:
                self.log_result("System Dependency Check", False,
                              f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("System Dependency Check", False, f"Exception: {str(e)}")
    
    def test_github_search(self, query: str, source_type: str):
        """Test POST /api/search/github"""
        try:
            payload = {
                "query": query,
                "source_type": source_type
            }
            
            response = requests.post(f"{BACKEND_URL}/search/github", 
                                   json=payload, timeout=15)
            
            test_name = f"GitHub Search ({source_type}: {query})"
            
            if response.status_code == 200:
                data = response.json()
                
                if "status" in data and "results" in data:
                    results = data.get("results", [])
                    
                    # Validate result structure
                    if results:
                        first_result = results[0]
                        required_fields = ["name", "full_name", "clone_url", "stars"]
                        
                        if all(field in first_result for field in required_fields):
                            self.log_result(test_name, True,
                                          f"Found {len(results)} repositories", 
                                          {"count": len(results), "sample": first_result})
                        else:
                            self.log_result(test_name, False,
                                          f"Invalid result structure. Missing fields in: {first_result}")
                    else:
                        self.log_result(test_name, True,
                                      "No results found (valid response)", data)
                else:
                    self.log_result(test_name, False,
                                  f"Invalid response structure: {data}")
            else:
                self.log_result(test_name, False,
                              f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result(f"GitHub Search ({source_type}: {query})", False, f"Exception: {str(e)}")
    
    def test_gitlab_search(self, query: str, source_type: str):
        """Test POST /api/search/gitlab"""
        try:
            payload = {
                "query": query,
                "source_type": source_type
            }
            
            response = requests.post(f"{BACKEND_URL}/search/gitlab", 
                                   json=payload, timeout=15)
            
            test_name = f"GitLab Search ({source_type}: {query})"
            
            if response.status_code == 200:
                data = response.json()
                
                if "status" in data and "results" in data:
                    results = data.get("results", [])
                    
                    # Validate result structure
                    if results:
                        first_result = results[0]
                        required_fields = ["name", "full_name", "clone_url", "stars"]
                        
                        if all(field in first_result for field in required_fields):
                            self.log_result(test_name, True,
                                          f"Found {len(results)} repositories", 
                                          {"count": len(results), "sample": first_result})
                        else:
                            self.log_result(test_name, False,
                                          f"Invalid result structure. Missing fields in: {first_result}")
                    else:
                        self.log_result(test_name, True,
                                      "No results found (valid response)", data)
                else:
                    self.log_result(test_name, False,
                                  f"Invalid response structure: {data}")
            else:
                self.log_result(test_name, False,
                              f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result(f"GitLab Search ({source_type}: {query})", False, f"Exception: {str(e)}")
    
    def test_build_status_endpoint(self):
        """Test GET /api/build/status"""
        try:
            response = requests.get(f"{BACKEND_URL}/build/status", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["active", "stage", "progress", "eta", "logs", "build_id"]
                
                if all(field in data for field in required_fields):
                    active = data.get("active", False)
                    progress = data.get("progress", 0)
                    
                    self.log_result("Build Status", True,
                                  f"Active: {active}, Progress: {progress}%", data)
                else:
                    self.log_result("Build Status", False,
                                  f"Missing required fields. Got: {list(data.keys())}", data)
            else:
                self.log_result("Build Status", False,
                              f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Build Status", False, f"Exception: {str(e)}")
    
    def test_build_logs_endpoint(self):
        """Test GET /api/build/logs"""
        try:
            response = requests.get(f"{BACKEND_URL}/build/logs", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if "logs" in data:
                    logs = data.get("logs", [])
                    self.log_result("Build Logs", True,
                                  f"Retrieved {len(logs)} log entries", 
                                  {"log_count": len(logs)})
                else:
                    self.log_result("Build Logs", False,
                                  f"Missing 'logs' field in response: {data}")
            else:
                self.log_result("Build Logs", False,
                              f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Build Logs", False, f"Exception: {str(e)}")
    
    def test_build_history_endpoint(self):
        """Test GET /api/builds/history"""
        try:
            response = requests.get(f"{BACKEND_URL}/builds/history", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if "builds" in data:
                    builds = data.get("builds", [])
                    self.log_result("Build History", True,
                                  f"Retrieved {len(builds)} build records", 
                                  {"build_count": len(builds)})
                else:
                    self.log_result("Build History", False,
                                  f"Missing 'builds' field in response: {data}")
            else:
                self.log_result("Build History", False,
                              f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Build History", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run comprehensive backend API tests"""
        print("🚀 Starting AOSP ROM Builder Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Core health and system tests
        self.test_health_endpoint()
        self.test_system_check_endpoint()
        
        # GitHub search tests with realistic queries
        github_tests = [
            ("xiaomi poco", "device"),
            ("xiaomi kernel", "kernel"), 
            ("xiaomi vendor", "vendor"),
            ("samsung galaxy", "device"),
            ("oneplus kernel", "kernel")
        ]
        
        for query, source_type in github_tests:
            self.test_github_search(query, source_type)
            time.sleep(1)  # Rate limiting
        
        # GitLab search tests
        gitlab_tests = [
            ("lineageos device", "device"),
            ("android kernel", "kernel"),
            ("vendor blobs", "vendor")
        ]
        
        for query, source_type in gitlab_tests:
            self.test_gitlab_search(query, source_type)
            time.sleep(1)  # Rate limiting
        
        # Build management tests
        self.test_build_status_endpoint()
        self.test_build_logs_endpoint()
        self.test_build_history_endpoint()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r["success"]])
        failed_tests = len(self.failed_tests)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = AOSPBackendTester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n💥 {len(tester.failed_tests)} tests failed!")
        sys.exit(1)