# Mixpla E2E Tests

Black-box Playwright E2E tests for Mixpla submit-song flow.

## Purpose

This project provides end-to-end testing for the Mixpla song submission page (`/sunonation/submit-song`). It treats the Mixpla site as a pure black box over HTTP and simulates a real user submitting a song with audio file and agreement acceptance.

## Prerequisites

- Target Mixpla environment must be live and accessible
- Node.js installed
- Test backend configured to accept confirmation code `faffafa456` for email `test-user@example.com`

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

3. Set environment variables:
```bash
export BASE_URL=https://mixpla.io   # or another environment URL
```

4. Add a test audio file:
   - Place a small audio file (WAV or MP3) at `fixtures/test-audio.wav`
   - This file is used for testing the file upload functionality

## Usage

Run all tests:
```bash
npx playwright test
```

Run tests with UI mode:
```bash
npx playwright test --ui
```

## Test Coverage

The test `user can submit a song with audio file and agreement` verifies:
- Email input and "Send code" functionality
- Confirmation code entry (using fixed test code)
- Audio file upload
- Required metadata (Artist, Title)
- Music Upload Agreement checkbox acceptance
- Form submission and success confirmation

## Configuration

- Base URL configured via `BASE_URL` environment variable (defaults to `https://mixpla.io`)
- Tests run headless by default
- Uses Chromium browser
- Results saved to HTML report
