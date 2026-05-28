#!/usr/bin/env node
/**
 * Inlines the Google subspec of @capacitor-firebase/authentication into the
 * root podspec.
 *
 * Why: with `:subspecs => ['Google']` + `static_framework = true`, CocoaPods
 * fails to create a native target for the plugin. Its Swift sources never get
 * compiled, FirebaseAuthenticationPlugin is missing from the app binary, and
 * Capacitor reports UNIMPLEMENTED when JS calls signInWithGoogle on iOS.
 * Merging the subspec into the root spec sidesteps the bug.
 *
 * Runs from package.json postinstall. Idempotent.
 */
const fs = require('fs');
const path = require('path');

const podspecPath = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@capacitor-firebase',
  'authentication',
  'CapacitorFirebaseAuthentication.podspec'
);

if (!fs.existsSync(podspecPath)) {
  console.log('[patch] CapacitorFirebaseAuthentication.podspec not found, skipping.');
  process.exit(0);
}

const original = fs.readFileSync(podspecPath, 'utf8');

if (original.includes('-DRGCFA_INCLUDE_GOOGLE') && !original.includes("s.default_subspec = 'Lite'")) {
  console.log('[patch] CapacitorFirebaseAuthentication.podspec already patched.');
  process.exit(0);
}

const target = `  s.swift_version = '5.1'
  s.static_framework = true
  s.default_subspec = 'Lite'

  s.subspec 'Lite' do |lite|
    # Default subspec that does not contain optional third party dependencies.
  end

  s.subspec 'Google' do |google|
    google.xcconfig = { 'OTHER_SWIFT_FLAGS' => '$(inherited) -DRGCFA_INCLUDE_GOOGLE' }
    google.dependency 'GoogleSignIn', '7.1.0'
  end

  s.subspec 'Facebook' do |facebook|
    facebook.xcconfig = { 'OTHER_SWIFT_FLAGS' => '$(inherited) -DRGCFA_INCLUDE_FACEBOOK' }
    facebook.dependency 'FBSDKCoreKit', '18.0.0'
    facebook.dependency 'FBSDKLoginKit', '18.0.0'
  end
end`;

const replacement = `  s.swift_version = '5.1'
  s.static_framework = true
  # Local patch: merged the Google subspec into the root spec.
  # Reason: with :subspecs => ['Google'] + static_framework = true, CocoaPods
  # fails to create a native target for the plugin, so its Swift sources
  # never get compiled and FirebaseAuthenticationPlugin is missing at runtime
  # (Capacitor reports UNIMPLEMENTED). Inlining the Google subspec sidesteps
  # the bug while keeping the Google Sign-In flow working.
  s.xcconfig = { 'OTHER_SWIFT_FLAGS' => '$(inherited) -DRGCFA_INCLUDE_GOOGLE' }
  s.dependency 'GoogleSignIn', '7.1.0'
end`;

if (!original.includes(target)) {
  console.warn(
    '[patch] CapacitorFirebaseAuthentication.podspec layout has changed; ' +
      'skipping patch. iOS Google Sign-In may break — review the podspec.'
  );
  process.exit(0);
}

fs.writeFileSync(podspecPath, original.replace(target, replacement));
console.log('[patch] CapacitorFirebaseAuthentication.podspec patched for iOS Google Sign-In.');
