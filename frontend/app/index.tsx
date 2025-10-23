import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');

const API_URL = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || 'http://localhost:8001';

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [systemReady, setSystemReady] = useState(false);
  const [checkingSystem, setCheckingSystem] = useState(false);
  const [buildDirectory, setBuildDirectory] = useState('/home/user/aosp-build');
  
  // Source configurations
  const [deviceTreeMethod, setDeviceTreeMethod] = useState<'search' | 'manual'>('search');
  const [kernelMethod, setKernelMethod] = useState<'search' | 'manual'>('search');
  const [vendorMethod, setVendorMethod] = useState<'search' | 'manual'>('search');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [deviceTree, setDeviceTree] = useState({ method: '', value: '' });
  const [kernel, setKernel] = useState({ method: '', value: '' });
  const [vendor, setVendor] = useState({ method: '', value: '' });
  
  // Build config
  const [deviceName, setDeviceName] = useState('');
  const [deviceCodename, setDeviceCodename] = useState('');
  const [androidVersion, setAndroidVersion] = useState('15');
  const [buildVariant, setBuildVariant] = useState('userdebug');
  
  // Build status
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStage, setBuildStage] = useState('');
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  
  const progressAnim = new Animated.Value(0);

  useEffect(() => {
    checkSystemRequirements();
  }, []);

  useEffect(() => {
    if (building) {
      const interval = setInterval(fetchBuildStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [building]);

  const checkSystemRequirements = async () => {
    setCheckingSystem(true);
    try {
      const response = await fetch(`${API_URL}/api/system/check`);
      const data = await response.json();
      setSystemReady(data.system_ready);
      
      if (!data.system_ready) {
        Alert.alert(
          'Missing Dependencies',
          `The following packages are missing: ${data.missing.join(', ')}. Would you like to install them?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Install', onPress: installDependencies }
          ]
        );
      }
    } catch (error) {
      console.error('Error checking system:', error);
    } finally {
      setCheckingSystem(false);
    }
  };

  const installDependencies = async () => {
    try {
      const response = await fetch(`${API_URL}/api/system/install-dependencies`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.status === 'success') {
        Alert.alert('Success', 'Dependencies installed successfully!');
        setSystemReady(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to install dependencies');
    }
  };

  const searchGitHub = async (sourceType: string) => {
    if (!searchQuery) return;
    
    setSearching(true);
    try {
      const response = await fetch(`${API_URL}/api/search/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          source_type: sourceType
        })
      });
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to search GitHub');
    } finally {
      setSearching(false);
    }
  };

  const selectRepository = (repo: any, sourceType: string) => {
    const config = { method: 'github', value: repo.clone_url };
    
    if (sourceType === 'device') {
      setDeviceTree(config);
    } else if (sourceType === 'kernel') {
      setKernel(config);
    } else if (sourceType === 'vendor') {
      setVendor(config);
    }
    
    setSearchResults([]);
    setSearchQuery('');
  };

  const startBuild = async () => {
    if (!deviceName || !deviceCodename || !deviceTree.value || !kernel.value || !vendor.value) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    setBuilding(true);
    try {
      const response = await fetch(`${API_URL}/api/build/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_name: deviceName,
          device_codename: deviceCodename,
          android_version: androidVersion,
          build_variant: buildVariant,
          build_directory: buildDirectory,
          device_tree: { source_type: 'device', ...deviceTree },
          kernel: { source_type: 'kernel', ...kernel },
          vendor: { source_type: 'vendor', ...vendor }
        })
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        setCurrentStep(4); // Move to build dashboard
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start build');
      setBuilding(false);
    }
  };

  const fetchBuildStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/build/status`);
      const data = await response.json();
      
      setBuildProgress(data.progress);
      setBuildStage(data.stage);
      
      // Fetch logs
      const logsResponse = await fetch(`${API_URL}/api/build/logs`);
      const logsData = await logsResponse.json();
      setBuildLogs(logsData.logs);
      
      if (data.progress >= 100 || !data.active) {
        setBuilding(false);
      }
    } catch (error) {
      console.error('Error fetching build status:', error);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Ionicons name="construct" size={32} color="white" />
        <Text style={styles.headerTitle}>AOSP ROM Builder</Text>
      </View>
      <Text style={styles.headerSubtitle}>Build Custom Android ROMs</Text>
    </View>
  );

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {['Setup', 'Device Tree', 'Kernel', 'Vendor', 'Build'].map((step, index) => (
        <View key={index} style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              currentStep >= index && styles.stepCircleActive
            ]}
          >
            <Text
              style={[
                styles.stepNumber,
                currentStep >= index && styles.stepNumberActive
              ]}
            >
              {index + 1}
            </Text>
          </View>
          <Text style={styles.stepLabel}>{step}</Text>
        </View>
      ))}
    </View>
  );

  const renderSetupStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>System Setup</Text>
      
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="settings-outline" size={24} color="#667eea" />
          <Text style={styles.cardTitle}>System Requirements</Text>
        </View>
        
        {checkingSystem ? (
          <ActivityIndicator size="large" color="#667eea" />
        ) : (
          <View style={styles.statusContainer}>
            <Ionicons
              name={systemReady ? 'checkmark-circle' : 'alert-circle'}
              size={48}
              color={systemReady ? '#10b981' : '#ef4444'}
            />
            <Text style={styles.statusText}>
              {systemReady ? 'System Ready!' : 'Dependencies Missing'}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Build Directory</Text>
        <TextInput
          style={styles.input}
          value={buildDirectory}
          onChangeText={setBuildDirectory}
          placeholder="/home/user/aosp-build"
          placeholderTextColor="#9ca3af"
        />
        <Text style={styles.helperText}>
          Note: AOSP source requires 200GB+ free space
        </Text>
      </View>
      
      <TouchableOpacity
        style={[styles.button, !systemReady && styles.buttonDisabled]}
        onPress={() => setCurrentStep(1)}
        disabled={!systemReady}
      >
        <Text style={styles.buttonText}>Continue</Text>
        <Ionicons name="arrow-forward" size={20} color="white" />
      </TouchableOpacity>
    </View>
  );

  const renderSourceStep = (title: string, sourceType: string, method: any, setMethod: any, source: any, setSource: any) => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{title}</Text>
      
      <View style={styles.methodSelector}>
        <TouchableOpacity
          style={[styles.methodButton, method === 'search' && styles.methodButtonActive]}
          onPress={() => setMethod('search')}
        >
          <Ionicons name="search" size={20} color={method === 'search' ? 'white' : '#667eea'} />
          <Text style={[styles.methodButtonText, method === 'search' && styles.methodButtonTextActive]}>
            Search Online
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.methodButton, method === 'manual' && styles.methodButtonActive]}
          onPress={() => setMethod('manual')}
        >
          <Ionicons name="create" size={20} color={method === 'manual' ? 'white' : '#667eea'} />
          <Text style={[styles.methodButtonText, method === 'manual' && styles.methodButtonTextActive]}>
            Manual Input
          </Text>
        </TouchableOpacity>
      </View>
      
      {method === 'search' ? (
        <View>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search for ${sourceType}...`}
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => searchGitHub(sourceType)}
            >
              {searching ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="search" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
          
          {searchResults.length > 0 && (
            <ScrollView style={styles.resultsContainer}>
              {searchResults.map((repo, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.resultItem}
                  onPress={() => selectRepository(repo, sourceType)}
                >
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultName}>{repo.name}</Text>
                    <View style={styles.starsContainer}>
                      <Ionicons name="star" size={14} color="#fbbf24" />
                      <Text style={styles.starsText}>{repo.stars}</Text>
                    </View>
                  </View>
                  <Text style={styles.resultDescription} numberOfLines={2}>
                    {repo.description || 'No description'}
                  </Text>
                  <Text style={styles.resultUrl}>{repo.full_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : (
        <View>
          <View style={styles.manualOptions}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                const method = 'url';
                setSource({ ...source, method });
              }}
            >
              <Ionicons name="link" size={24} color="#667eea" />
              <Text style={styles.optionText}>Git URL</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                const method = 'local';
                setSource({ ...source, method });
              }}
            >
              <Ionicons name="folder" size={24} color="#667eea" />
              <Text style={styles.optionText}>Local Path</Text>
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={styles.input}
            value={source.value}
            onChangeText={(text) => setSource({ ...source, value: text })}
            placeholder={source.method === 'local' ? '/path/to/local/folder' : 'https://github.com/...'}
            placeholderTextColor="#9ca3af"
          />
        </View>
      )}
      
      {source.value && (
        <View style={styles.selectedSource}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <Text style={styles.selectedText}>{source.value}</Text>
        </View>
      )}
      
      <View style={styles.navigationButtons}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep(currentStep - 1)}
        >
          <Ionicons name="arrow-back" size={20} color="#667eea" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, !source.value && styles.buttonDisabled]}
          onPress={() => setCurrentStep(currentStep + 1)}
          disabled={!source.value}
        >
          <Text style={styles.buttonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBuildConfigStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Build Configuration</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Device Name</Text>
        <TextInput
          style={styles.input}
          value={deviceName}
          onChangeText={setDeviceName}
          placeholder="e.g., Lenovo K10 Note"
          placeholderTextColor="#9ca3af"
        />
      </View>
      
      <View style={styles.card}>
        <Text style={styles.label}>Device Codename</Text>
        <TextInput
          style={styles.input}
          value={deviceCodename}
          onChangeText={setDeviceCodename}
          placeholder="e.g., kunlun2"
          placeholderTextColor="#9ca3af"
        />
      </View>
      
      <View style={styles.card}>
        <Text style={styles.label}>Android Version</Text>
        <View style={styles.versionSelector}>
          {['14', '15', '16'].map((version) => (
            <TouchableOpacity
              key={version}
              style={[
                styles.versionButton,
                androidVersion === version && styles.versionButtonActive
              ]}
              onPress={() => setAndroidVersion(version)}
            >
              <Text
                style={[
                  styles.versionText,
                  androidVersion === version && styles.versionTextActive
                ]}
              >
                Android {version}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.label}>Build Variant</Text>
        <View style={styles.versionSelector}>
          {['user', 'userdebug', 'eng'].map((variant) => (
            <TouchableOpacity
              key={variant}
              style={[
                styles.versionButton,
                buildVariant === variant && styles.versionButtonActive
              ]}
              onPress={() => setBuildVariant(variant)}
            >
              <Text
                style={[
                  styles.versionText,
                  buildVariant === variant && styles.versionTextActive
                ]}
              >
                {variant}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      <View style={styles.navigationButtons}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setCurrentStep(currentStep - 1)}
        >
          <Ionicons name="arrow-back" size={20} color="#667eea" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.button}
          onPress={startBuild}
        >
          <Text style={styles.buttonText}>Start Build</Text>
          <Ionicons name="hammer" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBuildDashboard = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Building ROM</Text>
      
      <View style={styles.card}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>{buildStage}</Text>
          <Text style={styles.progressPercentage}>{buildProgress}%</Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${buildProgress}%` }]} />
        </View>
        
        {building && (
          <View style={styles.buildingIndicator}>
            <ActivityIndicator size="small" color="#667eea" />
            <Text style={styles.buildingText}>Building... This may take several hours</Text>
          </View>
        )}
      </View>
      
      <View style={styles.logsCard}>
        <View style={styles.logsHeader}>
          <Ionicons name="terminal" size={20} color="#667eea" />
          <Text style={styles.logsTitle}>Build Logs</Text>
        </View>
        
        <ScrollView style={styles.logsContainer}>
          {buildLogs.map((log, index) => (
            <Text key={index} style={styles.logLine}>
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>
      
      {!building && buildProgress >= 100 && (
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            setCurrentStep(0);
            setBuildProgress(0);
            setBuildStage('');
            setBuildLogs([]);
          }}
        >
          <Text style={styles.buttonText}>Start New Build</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderStepIndicator()}
      
      <ScrollView style={styles.content}>
        {currentStep === 0 && renderSetupStep()}
        {currentStep === 1 && renderSourceStep('Device Tree', 'device', deviceTreeMethod, setDeviceTreeMethod, deviceTree, setDeviceTree)}
        {currentStep === 2 && renderSourceStep('Kernel', 'kernel', kernelMethod, setKernelMethod, kernel, setKernel)}
        {currentStep === 3 && renderSourceStep('Vendor', 'vendor', vendorMethod, setVendorMethod, vendor, setVendor)}
        {currentStep === 4 && renderBuildConfigStep()}
        {currentStep === 5 && renderBuildDashboard()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6'
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 12
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)'
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  stepItem: {
    alignItems: 'center'
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  stepCircleActive: {
    backgroundColor: '#667eea'
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280'
  },
  stepNumberActive: {
    color: 'white'
  },
  stepLabel: {
    fontSize: 10,
    color: '#6b7280'
  },
  content: {
    flex: 1
  },
  stepContent: {
    padding: 20
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 20
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    color: '#1f2937'
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8
  },
  button: {
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#667eea',
    backgroundColor: 'white'
  },
  methodButtonActive: {
    backgroundColor: '#667eea'
  },
  methodButtonText: {
    color: '#667eea',
    fontWeight: '600',
    marginLeft: 8
  },
  methodButtonTextActive: {
    color: 'white'
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  searchButton: {
    backgroundColor: '#667eea',
    borderRadius: 8,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center'
  },
  resultsContainer: {
    maxHeight: 300
  },
  resultItem: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937'
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  starsText: {
    fontSize: 12,
    color: '#6b7280'
  },
  resultDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4
  },
  resultUrl: {
    fontSize: 11,
    color: '#667eea'
  },
  manualOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  optionButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  optionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937'
  },
  selectedSource: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    marginTop: 16
  },
  selectedText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#065f46',
    flex: 1
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#667eea'
  },
  backButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  versionSelector: {
    flexDirection: 'row',
    gap: 8
  },
  versionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center'
  },
  versionButtonActive: {
    borderColor: '#667eea',
    backgroundColor: '#eef2ff'
  },
  versionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600'
  },
  versionTextActive: {
    color: '#667eea'
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937'
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea'
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 4
  },
  buildingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8
  },
  buildingText: {
    fontSize: 14,
    color: '#6b7280'
  },
  logsCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  logsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8
  },
  logsContainer: {
    maxHeight: 300
  },
  logLine: {
    fontSize: 11,
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 2
  }
});