

## Plan: Add Voice Input to Interview Chat

### Problem
The interview chat (both in Onboarding and AIAgent pages) only supports text input. Users want to respond via voice, with audio automatically transcribed and sent as text.

### Approach
1. **New Edge Function** (`transcribe-browser-audio`): Receives base64-encoded audio from the browser, sends it to Groq Whisper API for transcription, and returns the text. The existing `transcribe-audio` function is tied to Evolution API/WhatsApp and cannot be reused.

2. **Reusable `AudioRecordButton` component**: A microphone button that uses the browser's `MediaRecorder` API to capture audio, converts to base64, calls the new edge function, and returns transcribed text via a callback.

3. **Integrate into both interview UIs**: Add the mic button next to the send button in `AIAgent.tsx` (line ~642) and `Onboarding.tsx` (line ~776). On transcription complete, the text is inserted into the input field (or sent directly).

### Technical Details

**New file: `supabase/functions/transcribe-browser-audio/index.ts`**
- Accepts `{ audio: string (base64), mimeType: string }`
- Sends to Groq Whisper (`whisper-large-v3-turbo`, language `pt`)
- Uses existing `GROQ_API_KEY` secret
- Returns `{ text: string }`

**New file: `src/components/AudioRecordButton.tsx`**
- States: idle → recording → transcribing
- Uses `navigator.mediaDevices.getUserMedia` + `MediaRecorder`
- On stop: converts blob to base64, calls edge function
- Props: `onTranscription(text: string)`, `disabled: boolean`
- Visual: Mic icon (idle), pulsing red mic (recording), spinner (transcribing)

**Modified: `src/pages/AIAgent.tsx`**
- Import `AudioRecordButton`
- Add next to Send button in the chat input area (~line 642)
- `onTranscription` sets `userInput` with the transcribed text

**Modified: `src/pages/Onboarding.tsx`**
- Same pattern — add mic button next to Send in interview chat (~line 776)
- `onTranscription` sets `userInput` with the transcribed text

**Config: `supabase/config.toml`**
- Add `[functions.transcribe-browser-audio]` with `verify_jwt = false`

