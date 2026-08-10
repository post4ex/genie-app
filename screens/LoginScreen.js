import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE } from '../config/api';
import { COLORS } from '../styles/theme';

export default function LoginScreen({ onLoginSuccess }) {
  const insets = useSafeAreaInsets();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register' | 'kyc' | 'forgot'

  // Login state
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Register state
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regName, setRegName] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regStep, setRegStep] = useState(1);

  // KYC state
  const [kycType, setKycType] = useState('AADHAAR');
  const [kycNumber, setKycNumber] = useState('');
  const [kycAddress, setKycAddress] = useState('');

  // Forgot Password state
  const [forgotId, setForgotId] = useState('');
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [forgotStep, setForgotStep] = useState(1);

  // ── Login Handler matching GENIE_WEB /api/public/login ───────────────────────
  const handleLoginSubmit = async () => {
    if (!loginUser || !loginPass) {
      setAuthError('Please enter username and password');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/public/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser.trim(), password: loginPass.trim() })
      });
      const data = await res.json();
      if (data.status === 'success' && data.sessionId) {
        onLoginSuccess(data.userData || { username: loginUser, role: 'CLIENT' }, data.sessionId);
      } else {
        setAuthError(data.message || data.detail || 'Invalid username or password');
      }
    } catch (err) {
      setAuthError('Connection error: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Register Handler matching GENIE_WEB ──────────────────────────────────────
  const handleRegisterSubmit = async () => {
    if (regStep === 1) {
      if (!regUser || !regEmail || !regMobile || !regPass) {
        Alert.alert("Missing Fields", "Please complete all required fields");
        return;
      }
      if (regPass.length < 8 || !/[A-Z]/.test(regPass)) {
        Alert.alert("Weak Password", "Password must be at least 8 characters and contain 1 uppercase letter.");
        return;
      }
      if (regPass !== regConfirmPass) {
        Alert.alert("Password Mismatch", "Password and Confirm Password must match");
        return;
      }
      setAuthLoading(true);
      try {
        const payload = {
          USER: regUser.trim(),
          EMAIL: regEmail.trim().toLowerCase(),
          MOBILE: regMobile.trim(),
          NAME: regName.trim(),
          PASS: regPass.trim(),
          ROLE: 'CLIENT',
          STATUS: 'PENDING'
        };
        const res = await fetch(`${API_BASE}/api/public/initiateRegistration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'success') {
          setRegStep(2);
          Alert.alert("OTP Sent", "Verification code sent to your email.");
        } else {
          Alert.alert("Registration Error", data.message || data.detail || "Failed to send OTP");
        }
      } catch (e) {
        Alert.alert("Network Error", e.message);
      } finally {
        setAuthLoading(false);
      }
    } else {
      if (!regOtp) {
        Alert.alert("Enter OTP", "Please enter the OTP sent to your email");
        return;
      }
      setAuthLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/confirmRegistration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: regEmail.trim().toLowerCase(), otp: regOtp.trim() })
        });
        const data = await res.json();
        if (data.status === 'success') {
          setAuthView('kyc');
        } else {
          Alert.alert("OTP Error", data.message || data.detail || "Invalid OTP");
        }
      } catch (e) {
        Alert.alert("Network Error", e.message);
      } finally {
        setAuthLoading(false);
      }
    }
  };

  const handleKycSubmit = async () => {
    Alert.alert("Registration Submitted", "Your registration has been submitted! Please log in.");
    setAuthView('login');
    setLoginUser(regUser);
  };

  // ── Forgot Password Handler matching GENIE_WEB ───────────────────────────────
  const handleForgotSubmit = async () => {
    if (forgotStep === 1) {
      if (!forgotId) {
        Alert.alert("Missing Field", "Please enter Username or Email");
        return;
      }
      setAuthLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/public/sendResetOtp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: forgotId.trim(), mobile: forgotMobile.trim() })
        });
        const data = await res.json();
        if (data.status === 'success') {
          setForgotStep(2);
          Alert.alert("OTP Sent", "Verification code sent to your registered contact.");
        } else {
          Alert.alert("Error", data.message || data.detail || "User not found");
        }
      } catch (e) {
        Alert.alert("Error", e.message);
      } finally {
        setAuthLoading(false);
      }
    } else if (forgotStep === 2) {
      if (!forgotOtp) {
        Alert.alert("Missing OTP", "Please enter OTP");
        return;
      }
      setAuthLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/verifyResetOtp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: forgotId.trim(), otp: forgotOtp.trim() })
        });
        const data = await res.json();
        if (data.token) {
          setForgotResetToken(data.token);
          setForgotStep(3);
        } else {
          Alert.alert("Verification Error", data.detail || data.message || "Invalid OTP");
        }
      } catch (e) {
        Alert.alert("Error", e.message);
      } finally {
        setAuthLoading(false);
      }
    } else {
      if (!forgotNewPass || forgotNewPass.length < 8) {
        Alert.alert("Invalid Password", "Password must be at least 8 characters.");
        return;
      }
      setAuthLoading(true);
      try {
        await fetch(`${API_BASE}/api/resetPass`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: forgotId.trim(), token: forgotResetToken, newPassword: forgotNewPass.trim() })
        });
        Alert.alert("Password Reset!", "Your password has been updated. Please sign in.");
        setAuthView('login');
        setForgotStep(1);
      } catch (e) {
        Alert.alert("Reset Error", e.message);
      } finally {
        setAuthLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollAuth, { paddingBottom: Math.max(insets.bottom + 20, 28) }]}
      >
          {/* VIEW: LOGIN */}
          {authView === 'login' && (
            <View style={styles.cardWeb}>
              <Text style={styles.cardTitleWeb}>Log In</Text>

              {authError ? <Text style={styles.errorTextWeb}>{authError}</Text> : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.labelWeb}>Username</Text>
                <TextInput
                  style={styles.inputWeb}
                  placeholder="Enter username"
                  placeholderTextColor="#94a3b8"
                  value={loginUser}
                  onChangeText={setLoginUser}
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.labelWeb}>Password</Text>
                <View style={styles.passRowWeb}>
                  <TextInput
                    style={[styles.inputWeb, { flex: 1 }]}
                    placeholder="Enter password"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showLoginPass}
                    value={loginPass}
                    onChangeText={setLoginPass}
                  />
                  <TouchableOpacity style={styles.eyeBtnWeb} onPress={() => setShowLoginPass(!showLoginPass)}>
                    <Text style={styles.eyeIconWeb}>{showLoginPass ? '👁️' : '🙈'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.forgotLinkWeb} onPress={() => { setAuthView('forgot'); setForgotStep(1); }}>
                <Text style={styles.forgotLinkTextWeb}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnWeb} onPress={handleLoginSubmit} disabled={authLoading}>
                {authLoading ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.btnWebText}>LOG IN</Text>}
              </TouchableOpacity>

              <View style={styles.switchRowWeb}>
                <Text style={styles.switchTextWeb}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => { setAuthView('register'); setRegStep(1); }}>
                  <Text style={styles.switchHighlightWeb}>Register Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* VIEW: REGISTER */}
          {authView === 'register' && (
            <View style={styles.cardWeb}>
              <Text style={styles.cardTitleWeb}>Create Account</Text>
              <Text style={styles.cardSubWeb}>Step 1: Basic Details</Text>

              {regStep === 1 ? (
                <>
                  <Text style={styles.labelWeb}>Desired Username</Text>
                  <TextInput style={styles.inputWeb} placeholder="e.g. john_express" placeholderTextColor="#94a3b8" value={regUser} onChangeText={setRegUser} autoCapitalize="none" />

                  <Text style={styles.labelWeb}>Email Address</Text>
                  <TextInput style={styles.inputWeb} placeholder="john@example.com" placeholderTextColor="#94a3b8" keyboardType="email-address" value={regEmail} onChangeText={setRegEmail} autoCapitalize="none" />

                  <Text style={styles.labelWeb}>Mobile Number</Text>
                  <TextInput style={styles.inputWeb} placeholder="9876543210" placeholderTextColor="#94a3b8" keyboardType="phone-pad" value={regMobile} onChangeText={setRegMobile} />

                  <Text style={styles.labelWeb}>Full Name</Text>
                  <TextInput style={styles.inputWeb} placeholder="John Doe" placeholderTextColor="#94a3b8" value={regName} onChangeText={setRegName} />

                  <Text style={styles.labelWeb}>Password (Min 8 chars, 1 Cap)</Text>
                  <TextInput style={styles.inputWeb} placeholder="Min 8 chars" placeholderTextColor="#94a3b8" secureTextEntry value={regPass} onChangeText={setRegPass} />

                  <Text style={styles.labelWeb}>Confirm Password</Text>
                  <TextInput style={styles.inputWeb} placeholder="Re-enter password" placeholderTextColor="#94a3b8" secureTextEntry value={regConfirmPass} onChangeText={setRegConfirmPass} />
                </>
              ) : (
                <>
                  <View style={styles.infoBoxWeb}>
                    <Text style={styles.infoBoxTextWeb}>OTP sent to your email. Valid for 5 minutes.</Text>
                  </View>
                  <Text style={styles.labelWeb}>ENTER OTP</Text>
                  <TextInput style={[styles.inputWeb, { textAlign: 'center', letterSpacing: 6, fontSize: 20, fontWeight: 'bold' }]} placeholder="••••••" placeholderTextColor="#94a3b8" keyboardType="numeric" value={regOtp} onChangeText={setRegOtp} />
                </>
              )}

              <TouchableOpacity style={styles.btnOtpWeb} onPress={handleRegisterSubmit} disabled={authLoading}>
                {authLoading ? <ActivityIndicator color="#ea580c" /> : <Text style={styles.btnOtpText}>{regStep === 1 ? 'Send OTP' : 'Confirm OTP'}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnGhostWeb} onPress={() => setAuthView('login')}>
                <Text style={styles.btnGhostText}>← Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* VIEW: REGISTER KYC */}
          {authView === 'kyc' && (
            <View style={styles.cardWeb}>
              <Text style={styles.cardTitleWeb}>Complete Profile</Text>
              <Text style={styles.cardSubWeb}>Step 2: KYC & Address Details</Text>

              <Text style={styles.labelWeb}>KYC Type</Text>
              <View style={styles.pickerRow}>
                {['AADHAAR', 'PAN', 'GST'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.pickerChipWeb, kycType === type && styles.pickerChipActiveWeb]}
                    onPress={() => setKycType(type)}
                  >
                    <Text style={[styles.pickerChipTextWeb, kycType === type && styles.pickerChipTextActiveWeb]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.labelWeb}>Document Number</Text>
              <TextInput style={styles.inputWeb} placeholder="Enter ID number" placeholderTextColor="#94a3b8" value={kycNumber} onChangeText={setKycNumber} />

              <Text style={styles.labelWeb}>Full Address</Text>
              <TextInput style={[styles.inputWeb, { height: 70, textAlignVertical: 'top' }]} multiline numberOfLines={3} placeholder="Complete physical address" placeholderTextColor="#94a3b8" value={kycAddress} onChangeText={setKycAddress} />

              <TouchableOpacity style={styles.btnWeb} onPress={handleKycSubmit} disabled={authLoading}>
                {authLoading ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.btnWebText}>Submit Registration</Text>}
              </TouchableOpacity>

              <View style={styles.warningNoteWeb}>
                <Text style={styles.warningNoteTextWeb}>Note: You will need to provide physical copies later for verification.</Text>
              </View>
            </View>
          )}

          {/* VIEW: FORGOT PASSWORD */}
          {authView === 'forgot' && (
            <View style={styles.cardWeb}>
              <Text style={styles.cardTitleWeb}>Reset Password</Text>

              {forgotStep === 1 && (
                <>
                  <Text style={styles.labelWeb}>Username / Email</Text>
                  <TextInput style={styles.inputWeb} placeholder="Registered username or email" placeholderTextColor="#94a3b8" value={forgotId} onChangeText={setForgotId} autoCapitalize="none" />

                  <Text style={styles.labelWeb}>Registered Mobile</Text>
                  <TextInput style={styles.inputWeb} placeholder="10-digit mobile number" placeholderTextColor="#94a3b8" keyboardType="phone-pad" value={forgotMobile} onChangeText={setForgotMobile} />
                </>
              )}

              {forgotStep === 2 && (
                <>
                  <View style={styles.infoBoxWeb}>
                    <Text style={styles.infoBoxTextWeb}>OTP sent! Check your email.</Text>
                  </View>
                  <Text style={styles.labelWeb}>Enter OTP</Text>
                  <TextInput style={[styles.inputWeb, { textAlign: 'center', letterSpacing: 6, fontSize: 20, fontWeight: 'bold' }]} placeholder="••••••" placeholderTextColor="#94a3b8" keyboardType="numeric" value={forgotOtp} onChangeText={setForgotOtp} />
                </>
              )}

              {forgotStep === 3 && (
                <>
                  <Text style={styles.labelWeb}>New Password</Text>
                  <TextInput style={styles.inputWeb} placeholder="Min 8 chars, 1 Cap" placeholderTextColor="#94a3b8" secureTextEntry value={forgotNewPass} onChangeText={setForgotNewPass} />
                </>
              )}

              <TouchableOpacity style={styles.btnOtpWeb} onPress={handleForgotSubmit} disabled={authLoading}>
                {authLoading ? <ActivityIndicator color="#ea580c" /> : <Text style={styles.btnOtpText}>{forgotStep === 1 ? 'Request OTP' : forgotStep === 2 ? 'Verify OTP' : 'Reset Password'}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnGhostWeb} onPress={() => setAuthView('login')}>
                <Text style={styles.btnGhostText}>← Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollAuth: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  cardWeb: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#e8c98a',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.08)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 }),
  },
  cardTitleWeb: {
    color: '#1e293b',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardSubWeb: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  labelWeb: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  inputWeb: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    color: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  passRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeBtnWeb: {
    position: 'absolute',
    right: 8,
    padding: 6,
  },
  eyeIconWeb: {
    fontSize: 16,
  },
  forgotLinkWeb: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotLinkTextWeb: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '600',
  },
  btnWeb: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnWebText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnOtpWeb: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ea580c',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnOtpText: {
    color: '#ea580c',
    fontSize: 14,
    fontWeight: '700',
  },
  btnGhostWeb: {
    backgroundColor: '#1e3a5f',
    borderWidth: 2,
    borderColor: '#1e3a5f',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  btnGhostText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  switchRowWeb: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  switchTextWeb: {
    color: '#64748b',
    fontSize: 12,
  },
  switchHighlightWeb: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  infoBoxWeb: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoBoxTextWeb: {
    color: '#1e40af',
    fontSize: 12,
    textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pickerChipWeb: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  pickerChipActiveWeb: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pickerChipTextWeb: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  pickerChipTextActiveWeb: {
    color: '#ffffff',
  },
  warningNoteWeb: {
    backgroundColor: '#fefce8',
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  warningNoteTextWeb: {
    color: '#854d0e',
    fontSize: 11,
    textAlign: 'center',
  },
  errorTextWeb: {
    color: '#dc2626',
    fontSize: 13,
    marginBottom: 12,
    fontWeight: '600',
  },
});
