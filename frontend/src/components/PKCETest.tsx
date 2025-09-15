/**
 * PKCE Testing Component
 * Demonstrates and tests PKCE functionality in real-time
 */

import React, { useState, useEffect } from 'react';
import { 
  generateCodeVerifier, 
  generateCodeChallenge, 
  storeCodeVerifier, 
  getCodeVerifier, 
  clearCodeVerifier,
  generateState,
  storeState,
  validateState 
} from '../utils/pkce';

interface PKCETestResult {
  verifier: string;
  challenge: string;
  verifierLength: number;
  challengeLength: number;
  isValidLength: boolean;
  timestamp: string;
}

export const PKCETest: React.FC = () => {
  const [testResult, setTestResult] = useState<PKCETestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [storageTest, setStorageTest] = useState<{
    stored: string | null;
    retrieved: string | null;
    matches: boolean;
  } | null>(null);
  const [stateTest, setStateTest] = useState<{
    generated: string;
    valid: boolean;
  } | null>(null);

  const runPKCETest = async () => {
    setLoading(true);
    
    try {
      // Generate PKCE parameters
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      
      const result: PKCETestResult = {
        verifier,
        challenge,
        verifierLength: verifier.length,
        challengeLength: challenge.length,
        isValidLength: verifier.length === 43 && challenge.length === 43,
        timestamp: new Date().toISOString()
      };
      
      setTestResult(result);
    } catch (error) {
      console.error('PKCE test failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const testStorage = () => {
    const testVerifier = generateCodeVerifier();
    
    // Store verifier
    storeCodeVerifier(testVerifier);
    
    // Retrieve verifier
    const retrieved = getCodeVerifier();
    
    setStorageTest({
      stored: testVerifier,
      retrieved,
      matches: testVerifier === retrieved
    });
  };

  const testStateValidation = () => {
    const state = generateState();
    storeState(state);
    const isValid = validateState(state);
    
    setStateTest({
      generated: state,
      valid: isValid
    });
  };

  const clearStorage = () => {
    clearCodeVerifier();
    sessionStorage.removeItem('oauth_state');
    setStorageTest(null);
    setStateTest(null);
  };

  useEffect(() => {
    // Run initial test
    runPKCETest();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          🔐 PKCE Testing Dashboard
        </h2>
        
        {/* PKCE Generation Test */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              PKCE Parameter Generation
            </h3>
            <button
              onClick={runPKCETest}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate New PKCE'}
            </button>
          </div>
          
          {testResult && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code Verifier ({testResult.verifierLength} chars)
                  </label>
                  <div className="bg-white p-3 rounded border text-xs font-mono break-all">
                    {testResult.verifier}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Code Challenge ({testResult.challengeLength} chars)
                  </label>
                  <div className="bg-white p-3 rounded border text-xs font-mono break-all">
                    {testResult.challenge}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className={`flex items-center space-x-2 ${testResult.isValidLength ? 'text-green-600' : 'text-red-600'}`}>
                  <span className="text-lg">
                    {testResult.isValidLength ? '✅' : '❌'}
                  </span>
                  <span className="font-medium">
                    Length Validation: {testResult.isValidLength ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
                
                <span className="text-sm text-gray-500">
                  Generated: {new Date(testResult.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Storage Test */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              SessionStorage Test
            </h3>
            <button
              onClick={testStorage}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Test Storage
            </button>
          </div>
          
          {storageTest && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stored Value
                  </label>
                  <div className="bg-white p-3 rounded border text-xs font-mono break-all">
                    {storageTest.stored}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Retrieved Value
                  </label>
                  <div className="bg-white p-3 rounded border text-xs font-mono break-all">
                    {storageTest.retrieved}
                  </div>
                </div>
              </div>
              
              <div className={`flex items-center space-x-2 ${storageTest.matches ? 'text-green-600' : 'text-red-600'}`}>
                <span className="text-lg">
                  {storageTest.matches ? '✅' : '❌'}
                </span>
                <span className="font-medium">
                  Storage Test: {storageTest.matches ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* State Validation Test */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              State Parameter Test
            </h3>
            <button
              onClick={testStateValidation}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              Test State
            </button>
          </div>
          
          {stateTest && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Generated State
                </label>
                <div className="bg-white p-3 rounded border text-xs font-mono break-all">
                  {stateTest.generated}
                </div>
              </div>
              
              <div className={`flex items-center space-x-2 ${stateTest.valid ? 'text-green-600' : 'text-red-600'}`}>
                <span className="text-lg">
                  {stateTest.valid ? '✅' : '❌'}
                </span>
                <span className="font-medium">
                  State Validation: {stateTest.valid ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Clear Storage */}
        <div className="flex justify-end">
          <button
            onClick={clearStorage}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Clear All Storage
          </button>
        </div>
      </div>

      {/* PKCE Flow Visualization */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          🔄 PKCE Flow Visualization
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              1
            </div>
            <div>
              <div className="font-medium">Generate code_verifier</div>
              <div className="text-sm text-gray-600">Random 32-byte string, base64url encoded</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 p-4 bg-green-50 rounded-lg">
            <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              2
            </div>
            <div>
              <div className="font-medium">Create code_challenge</div>
              <div className="text-sm text-gray-600">SHA256(code_verifier), base64url encoded</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 p-4 bg-yellow-50 rounded-lg">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              3
            </div>
            <div>
              <div className="font-medium">Authorization Request</div>
              <div className="text-sm text-gray-600">Send code_challenge + method=S256 to /auth</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 p-4 bg-purple-50 rounded-lg">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              4
            </div>
            <div>
              <div className="font-medium">Token Exchange</div>
              <div className="text-sm text-gray-600">Send code + code_verifier to /token</div>
            </div>
          </div>
        </div>
      </div>

      {/* Current SessionStorage Contents */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          💾 Current SessionStorage
        </h3>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
            {JSON.stringify({
              'pkce_code_verifier': sessionStorage.getItem('pkce_code_verifier'),
              'oauth_state': sessionStorage.getItem('oauth_state'),
              'access_token': sessionStorage.getItem('access_token') ? '[PRESENT]' : null,
              'refresh_token': sessionStorage.getItem('refresh_token') ? '[PRESENT]' : null,
            }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
