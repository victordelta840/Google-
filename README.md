# ASTRA SecureDrive (v1.0-HP16G)
## Operator Setup Phase: Welcome Voice, Voice Enrollment & Custom Password

Designed specifically for Victor Sir's 16 GB HP USB flash drive.

---

### 1. Phase Deliverables Summary

This phase is strictly scoped to operator identity onboarding:
1. **Premium Female Welcome Voice Integration**:
   - Google AI Studio Gemini TTS (`gemini-3.8-flash-lite-tts`, voice `Kore` / `Zephyr`).
   - Required dialogue: *"Welcome, Victor Sir."* [natural pause] *"Shall we proceed to authentication?"*
   - Live preview, approval gate, and `.wav` asset exporter for offline USB storage.
   - Offline audio file importer (`.wav` / `.mp3`).
2. **Personal Voice Setup Screen**:
   - Explicit microphone permission prompt via `navigator.mediaDevices.getUserMedia`.
   - Recording 3 specific verification calibration phrases.
   - Sample playback, review, individual deletion, and full enrollment data purge.
   - Transparent disclosure distinguishing speech-to-text from biological speaker verification (MFCC embeddings).
   - Clear prototype boundary: enrolling voice does not automatically unlock storage.
3. **Custom Password Setup Wizard**:
   - **No default password**. Password fields start completely empty.
   - Requires identical confirmation and minimum 8-character length.
   - Computes 16-byte random salt and PBKDF2-HMAC-SHA256 (100k rounds) key verification hash in memory.
   - Never hardcodes, logs, or persists plaintext passwords.
4. **Setup Dashboard Checklist**:
   - *Female Welcome Voice*: `Not configured` / `Previewed` / `Approved`
   - *Personal Voice Enrollment*: `Not started` / `Recording` / `Enrolled (Prototype only)`
   - *Custom Password*: `Not configured` / `Confirmed (Prototype only)`
   - "Setup Complete" displays only when all 3 sections are genuinely complete.

---

### 2. Scope Restrictions Compliance

The following downstream capabilities are explicitly deferred and NOT active in this phase:
- Encrypted-container mounting.
- USB hardware bus locking.
- Automatic USB autorun execution.
- Direct filesystem mounting.
- Storage unlocking based on voice enrollment alone.

---

### 3. Verification & Testing Instructions

1. **Test Voice Generation & Approval**:
   - Navigate to **1. Female Welcome Voice** tab.
   - Click **Generate & Preview Voice**. The server executes Gemini TTS (`Kore`) and streams back the audio.
   - Click **Approve This Welcome Voice** to lock in the choice.
2. **Test Personal Voice Enrollment**:
   - Navigate to **2. Personal Voice Setup** tab.
   - Click **Grant Microphone Permission**.
   - Record Sample 1, Sample 2, and Sample 3.
   - Listen to each sample to review.
   - Click **Confirm Voice Enrollment**.
3. **Test Custom Password Setup**:
   - Navigate to **3. Custom Password** tab.
   - Verify that fields are blank (no default password).
   - Attempt mismatched confirmation to verify rejection.
   - Enter matching passwords ($\ge 8$ chars) and click **Confirm Custom Password**.
4. **Test Setup Complete State & Startup Welcome**:
   - Verify top badge switches to **"SETUP COMPLETE (PROTOTYPE STAGE)"**.
   - Click **Test Startup Welcome** to hear Victor Sir's approved welcome voice.
5. **Run Self-Test Suite**:
   - Navigate to **4. Testing & Verification** and click **Run All Tests**.
