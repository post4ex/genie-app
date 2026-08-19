import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Image,
  ScrollView, Alert, KeyboardAvoidingView, StatusBar,
  Platform, TouchableWithoutFeedback, Keyboard, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { API_BASE } from '../config/api';
import Button from '../components/Button';
import Icon, { GradientIcon } from '../components/icons';
import GradientText from '../components/GradientText';
import Dropdown from '../components/Dropdown';

const TAGLINE_TEXT = 'Assistant to a Postman';

// Social authenticators (brand icons from FontAwesome6 brands set)
const SOCIAL_AUTHS = [
  { name: 'Google', icon: 'google', color: '#4285F4' },
  { name: 'Apple', icon: 'apple', color: '#111111' },
  { name: 'Microsoft', icon: 'microsoft', color: '#00A4EF' },
  { name: 'GitHub', icon: 'github', color: '#181717' },
  { name: 'WhatsApp', icon: 'whatsapp', color: '#25D366' },
];

// ── Shared auth input: label + underline input with an amber focus glow ─────
function AuthInput({ label, inputRef, field, focusedField, setFocusedField, style, multiline, ...props }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.labelWeb}>{label}</Text>
      <TextInput
        ref={inputRef}
        accessible
        placeholderTextColor="#94a3b8"
        style={[styles.inputWeb, multiline && styles.inputMultiline, focusedField === field && styles.inputFocused, style]}
        onFocus={() => setFocusedField(field)}
        onBlur={() => setFocusedField(null)}
        {...props}
      />
    </View>
  );
}

export default function LoginScreen({ onLoginSuccess }) {
  const insets = useSafeAreaInsets();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register' | 'kyc' | 'forgot'

  // Login state
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const loginUserInputRef = React.useRef(null);
  const loginPassInputRef = React.useRef(null);
  const regUserInputRef = React.useRef(null);
  const regEmailInputRef = React.useRef(null);
  const regMobileInputRef = React.useRef(null);
  const regNameInputRef = React.useRef(null);
  const regPassInputRef = React.useRef(null);
  const regConfirmPassInputRef = React.useRef(null);
  const regOtpInputRef = React.useRef(null);
  const forgotIdInputRef = React.useRef(null);
  const forgotMobileInputRef = React.useRef(null);
  const forgotOtpInputRef = React.useRef(null);
  const forgotNewPassInputRef = React.useRef(null);
  const kycNumberInputRef = React.useRef(null);
  const kycAddressInputRef = React.useRef(null);
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

  // Futuristic effects: entrance slide/fade + slowly pulsing glow orbs
  const [focusedField, setFocusedField] = useState(null);
  const [typedCount, setTypedCount] = useState(0);
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const cursorAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 4200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 4200, useNativeDriver: true }),
      ])
    );
    loop.start();
    // Typewriter: reveal the tagline char by char, then keep the cursor blinking
    let i = 0;
    const typeIv = setInterval(() => {
      i += 1;
      setTypedCount(i);
      if (i >= TAGLINE_TEXT.length) clearInterval(typeIv);
    }, 55);
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorAnim, { toValue: 0, duration: 480, useNativeDriver: true }),
        Animated.timing(cursorAnim, { toValue: 1, duration: 480, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => { loop.stop(); clearInterval(typeIv); blink.stop(); };
  }, [enter, pulse, cursorAnim]);

  const enterOpacity = enter;
  const heroTranslate = enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const cardTranslate = enter.interpolate({ inputRange: [0, 1], outputRange: [34, 0] });
  const orbOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });

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
        onLoginSuccess(
          data.userData || { USER: loginUser.trim(), ROLE: 'CLIENT' },
          data.sessionId,
          data.refreshToken || '',
          data.sessionExpiresAt || 0,
        );
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

  // ── Social login (placeholder until OAuth providers are wired) ──────────────
  const handleSocialLogin = (name) => {
    Alert.alert(`${name} Sign-In`, `${name} sign-in is coming soon.`);
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
    <LinearGradient
      colors={['#e0e7ff', '#c7d2fe', '#a5b4fc']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <StatusBar style="light" />

      {/* Floating glow orbs (futuristic ambient light) */}
      <Animated.View style={[styles.orb, styles.orbA, { opacity: orbOpacity, transform: [{ scale: orbScale }] }]} />
      <Animated.View style={[styles.orb, styles.orbB, { opacity: orbOpacity, transform: [{ scale: orbScale }] }]} />
      <Animated.View style={[styles.orb, styles.orbC, { opacity: orbOpacity, transform: [{ scale: orbScale }] }]} />

      {/* Web brand logo — pinned top-left (GENIE_WEB/assets/images/genie-logo.svg) */}
      <Animated.View
        style={[
          styles.hero,
          { top: Math.max(insets.top + 38, 68), opacity: enterOpacity, transform: [{ translateY: heroTranslate }] },
        ]}
      >
        <Image source={require('../assets/genie-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandTagline}>Courier · Logistics · Express</Text>
      </Animated.View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollAuth,
              {
                paddingBottom: Math.max(insets.bottom + 20, 28),
                ...(Platform.OS === 'web'
                  ? { justifyContent: 'center', paddingTop: 56 }
                  : { justifyContent: 'flex-start', paddingTop: Math.max(insets.top + 175, 195) }),
              },
            ]}
          >
            {/* Glass auth card */}
            <Animated.View style={[styles.card, { opacity: enterOpacity, transform: [{ translateY: cardTranslate }] }]}>
              {/* VIEW: LOGIN */}
              {authView === 'login' && (
                <View>
                  <GradientText colors={['#9C2007', '#f59e0b']} style={styles.cardTitleWeb}>Welcome Back</GradientText>
                  <Text style={styles.cardSubWeb}>Sign in to continue</Text>

                  {authError ? <Text style={styles.errorTextWeb}>{authError}</Text> : null}

                  <AuthInput
                    label="Username"
                    inputRef={loginUserInputRef}
                    field="loginUser"
                    focusedField={focusedField}
                    setFocusedField={setFocusedField}
                    placeholder="Enter username"
                    value={loginUser}
                    onChangeText={setLoginUser}
                    autoCapitalize="none"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => loginPassInputRef.current?.focus?.()}
                  />

                  <View style={styles.fieldGroup}>
                    <Text style={styles.labelWeb}>Password</Text>
                    <View style={styles.passRowWeb}>
                      <TextInput
                        ref={loginPassInputRef}
                        accessible
                        placeholderTextColor="#94a3b8"
                        style={[styles.inputWeb, styles.passInput, focusedField === 'loginPass' && styles.inputFocused]}
                        placeholder="Enter password"
                        secureTextEntry={!showLoginPass}
                        value={loginPass}
                        onChangeText={setLoginPass}
                        returnKeyType="done"
                        onSubmitEditing={handleLoginSubmit}
                        onFocus={() => setFocusedField('loginPass')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <TouchableOpacity style={styles.eyeBtnWeb} onPress={() => setShowLoginPass(!showLoginPass)}>
                        <Text style={styles.eyeIconWeb}>{showLoginPass ? '👁️' : '🙈'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.forgotLinkWeb} onPress={() => { setAuthView('forgot'); setForgotStep(1); }}>
                    <Text style={styles.forgotLinkTextWeb}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <Button
                    variant="primary"
                    colors={['#9C2007', '#9C2007']}
                    loading={authLoading}
                    accessibilityLabel="Log in"
                    onPress={handleLoginSubmit}
                    fullWidth
                  >
                    LOG IN
                  </Button>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <View style={styles.socialRow}>
                    {SOCIAL_AUTHS.map((s) => (
                      <TouchableOpacity
                        key={s.name}
                        style={styles.socialBtn}
                        onPress={() => handleSocialLogin(s.name)}
                        accessibilityLabel={`Sign in with ${s.name}`}
                      >
                        <Icon name={s.icon} family="brands" size={19} color={s.color} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.socialHint}>Sign in with your favourite account</Text>

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
                <View>
                  <GradientText colors={['#9C2007', '#f59e0b']} style={styles.cardTitleWeb}>Create Account</GradientText>
                  <Text style={styles.cardSubWeb}>Step 1: Basic Details</Text>

                  {regStep === 1 ? (
                    <>
                      <AuthInput label="Desired Username" inputRef={regUserInputRef} field="regUser" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="e.g. john_express" value={regUser} onChangeText={setRegUser} autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => regEmailInputRef.current?.focus?.()} />

                      <AuthInput label="Email Address" inputRef={regEmailInputRef} field="regEmail" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="john@example.com" keyboardType="email-address" value={regEmail} onChangeText={setRegEmail} autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => regMobileInputRef.current?.focus?.()} />

                      <AuthInput label="Mobile Number" inputRef={regMobileInputRef} field="regMobile" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="9876543210" keyboardType="phone-pad" value={regMobile} onChangeText={setRegMobile} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => regNameInputRef.current?.focus?.()} />

                      <AuthInput label="Full Name" inputRef={regNameInputRef} field="regName" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="John Doe" value={regName} onChangeText={setRegName} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => regPassInputRef.current?.focus?.()} />

                      <AuthInput label="Password (Min 8 chars, 1 Cap)" inputRef={regPassInputRef} field="regPass" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="Min 8 chars" secureTextEntry value={regPass} onChangeText={setRegPass} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => regConfirmPassInputRef.current?.focus?.()} />

                      <AuthInput label="Confirm Password" inputRef={regConfirmPassInputRef} field="regConfirmPass" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="Re-enter password" secureTextEntry value={regConfirmPass} onChangeText={setRegConfirmPass} returnKeyType="done" onSubmitEditing={handleRegisterSubmit} />
                    </>
                  ) : (
                    <>
                      <View style={styles.infoBoxWeb}>
                        <Text style={styles.infoBoxTextWeb}>OTP sent to your email. Valid for 5 minutes.</Text>
                      </View>
                      <AuthInput
                        label="ENTER OTP"
                        inputRef={regOtpInputRef}
                        field="regOtp"
                        focusedField={focusedField}
                        setFocusedField={setFocusedField}
                        placeholder="••••••"
                        keyboardType="numeric"
                        value={regOtp}
                        onChangeText={setRegOtp}
                        returnKeyType="done"
                        onSubmitEditing={handleRegisterSubmit}
                        style={styles.otpInput}
                      />
                    </>
                  )}

                  <Button
                    variant="otp"
                    loading={authLoading}
                    accessibilityLabel={regStep === 1 ? 'Send registration OTP' : 'Confirm registration OTP'}
                    onPress={handleRegisterSubmit}
                    fullWidth
                  >
                    {regStep === 1 ? 'Send OTP' : 'Confirm OTP'}
                  </Button>

                  <Button variant="secondary" icon="back" style={styles.cancelBtn} onPress={() => setAuthView('login')} fullWidth>
                    Cancel
                  </Button>
                </View>
              )}

              {/* VIEW: REGISTER KYC */}
              {authView === 'kyc' && (
                <View>
                  <GradientText colors={['#9C2007', '#f59e0b']} style={styles.cardTitleWeb}>Complete Profile</GradientText>
                  <Text style={styles.cardSubWeb}>Step 2: KYC & Address Details</Text>

                  <Dropdown
                    label="KYC TYPE"
                    value={kycType}
                    options={['AADHAAR', 'PAN', 'GST']}
                    onChange={setKycType}
                    placeholder="Select KYC Type"
                    style={{ marginBottom: 12 }}
                  />

                  <AuthInput label="Document Number" inputRef={kycNumberInputRef} field="kycNumber" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="Enter ID number" value={kycNumber} onChangeText={setKycNumber} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => kycAddressInputRef.current?.focus?.()} />

                  <AuthInput label="Full Address" inputRef={kycAddressInputRef} field="kycAddress" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="Complete physical address" multiline value={kycAddress} onChangeText={setKycAddress} returnKeyType="done" onSubmitEditing={handleKycSubmit} />

                  <Button
                    variant="primary"
                    colors={['#9C2007', '#9C2007']}
                    loading={authLoading}
                    accessibilityLabel="Submit registration"
                    onPress={handleKycSubmit}
                    fullWidth
                  >
                    Submit Registration
                  </Button>

                  <View style={styles.warningNoteWeb}>
                    <Text style={styles.warningNoteTextWeb}>Note: You will need to provide physical copies later for verification.</Text>
                  </View>
                </View>
              )}

              {/* VIEW: FORGOT PASSWORD */}
              {authView === 'forgot' && (
                <View>
                  <GradientText colors={['#9C2007', '#f59e0b']} style={styles.cardTitleWeb}>Reset Password</GradientText>
                  <Text style={styles.cardSubWeb}>We'll get you back in</Text>

                  {forgotStep === 1 && (
                    <>
                      <AuthInput label="Username / Email" inputRef={forgotIdInputRef} field="forgotId" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="Registered username or email" value={forgotId} onChangeText={setForgotId} autoCapitalize="none" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => forgotMobileInputRef.current?.focus?.()} />

                      <AuthInput label="Registered Mobile" inputRef={forgotMobileInputRef} field="forgotMobile" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="10-digit mobile number" keyboardType="phone-pad" value={forgotMobile} onChangeText={setForgotMobile} returnKeyType="done" onSubmitEditing={handleForgotSubmit} />
                    </>
                  )}

                  {forgotStep === 2 && (
                    <>
                      <View style={styles.infoBoxWeb}>
                        <Text style={styles.infoBoxTextWeb}>OTP sent! Check your email.</Text>
                      </View>
                      <AuthInput
                        label="Enter OTP"
                        inputRef={forgotOtpInputRef}
                        field="forgotOtp"
                        focusedField={focusedField}
                        setFocusedField={setFocusedField}
                        placeholder="••••••"
                        keyboardType="numeric"
                        value={forgotOtp}
                        onChangeText={setForgotOtp}
                        returnKeyType="done"
                        onSubmitEditing={handleForgotSubmit}
                        style={styles.otpInput}
                      />
                    </>
                  )}

                  {forgotStep === 3 && (
                    <AuthInput label="New Password" inputRef={forgotNewPassInputRef} field="forgotNewPass" focusedField={focusedField} setFocusedField={setFocusedField} placeholder="Min 8 chars, 1 Cap" secureTextEntry value={forgotNewPass} onChangeText={setForgotNewPass} returnKeyType="done" onSubmitEditing={handleForgotSubmit} />
                  )}

                  <Button
                    variant="otp"
                    loading={authLoading}
                    accessibilityLabel={forgotStep === 1 ? 'Request password reset OTP' : forgotStep === 2 ? 'Verify password reset OTP' : 'Reset password'}
                    onPress={handleForgotSubmit}
                    fullWidth
                  >
                    {forgotStep === 1 ? 'Request OTP' : forgotStep === 2 ? 'Verify OTP' : 'Reset Password'}
                  </Button>

                  <Button variant="secondary" icon="back" style={styles.cancelBtn} onPress={() => setAuthView('login')} fullWidth>
                    Cancel
                  </Button>
                </View>
              )}
            </Animated.View>

            {/* Tagline — flows with the content (not pinned) */}
            <Animated.View style={{ opacity: enterOpacity, marginTop: 22, alignItems: 'flex-start' }}>
              <View style={styles.taglinePill}>
                <GradientIcon name="wand-magic-sparkles" size={22} iconSize={11} />
                <Text style={styles.tagline}>
                  {TAGLINE_TEXT.slice(0, typedCount)}
                </Text>
                <Animated.Text style={[styles.taglineCursor, { opacity: cursorAnim }]}>▌</Animated.Text>
              </View>
            </Animated.View>

            <Text style={styles.footerNote}>A Post4Ex Project</Text>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollAuth: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  // Floating ambient orbs
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbA: {
    width: 230,
    height: 230,
    top: -70,
    left: -60,
    backgroundColor: 'rgba(99, 102, 241, 0.28)',
  },
  orbB: {
    width: 280,
    height: 280,
    top: '26%',
    right: -110,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
  },
  orbC: {
    width: 250,
    height: 250,
    bottom: -90,
    left: '20%',
    backgroundColor: 'rgba(139, 92, 246, 0.26)',
  },
  // Glass card
  // Web brand logo — pinned to the top-left corner
  hero: {
    position: 'absolute',
    left: 20,
    alignItems: 'flex-start',
  },
  logo: {
    width: 200,
    height: 64,
  },
  brandTagline: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 18px 50px rgba(79, 70, 229, 0.18)' }
      : { shadowColor: '#4338ca', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 26, elevation: 12 }),
  },
  cardTitleWeb: {
    color: '#1e293b',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 3,
  },
  cardSubWeb: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 18,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  labelWeb: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  inputWeb: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    borderRadius: 8,
    color: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  inputFocused: {
    borderBottomColor: '#6366f1',
    backgroundColor: '#ffffff',
  },
  inputMultiline: {
    height: 70,
    textAlignVertical: 'top',
  },
  otpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: 'bold',
  },
  passRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passInput: {
    flex: 1,
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
    marginBottom: 18,
  },
  forgotLinkTextWeb: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: 10,
  },
  // Tagline — glass pill with typewriter effect
  taglinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    paddingLeft: 7,
    paddingRight: 14,
    paddingVertical: 6,
    borderRadius: 999,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 6px 18px rgba(99, 102, 241, 0.22)' }
      : { shadowColor: '#6366f1', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 }),
  },
  tagline: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  taglineCursor: {
    color: '#9C2007',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: -4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 30,
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  socialBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 4px 12px rgba(15, 23, 42, 0.08)' }
      : { shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 }),
  },
  socialHint: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 10,
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
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '700',
  },
  infoBoxWeb: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  infoBoxTextWeb: {
    color: '#92400e',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pickerChipWeb: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pickerChipActiveWeb: {
    borderColor: 'rgba(249, 115, 22, 0.8)',
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
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  warningNoteTextWeb: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
  },
  errorTextWeb: {
    color: '#dc2626',
    fontSize: 13,
    marginBottom: 12,
    fontWeight: '600',
  },
  footerNote: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 22,
    letterSpacing: 1,
  },
});
