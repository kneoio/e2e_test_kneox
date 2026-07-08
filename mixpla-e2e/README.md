# Mixpla E2E Tests

Black-box Playwright E2E tests for Mixpla track submission flow.

## Purpose

This project provides end-to-end testing for the Mixpla track submission page (`/submission`). It treats the Mixpla site as a pure black box over HTTP and simulates a real user submitting a track through the 3-step wizard (email verification, track details + upload, success).

## Prerequisites

- Target Mixpla environment must be live and accessible
- Node.js installed
- Backend (datanest) must have the QA OTP bypass enabled: email `qa-test@mixpla.io` with code `424242` always verifies without sending a real email (see `OtpService.TEST_BYPASS_EMAIL` / `TEST_BYPASS_CODE`)

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

The test `user can submit a track with audio file and agreement` verifies:
- Email input and "Send Code" functionality
- Confirmation code entry (using the QA OTP bypass code)
- Artist name, genre, and station selection
- Audio file upload
- Submission terms agreement checkbox acceptance
- Form submission (`POST /public/songs/chunk`) and success step ("Thank you!")

## Configuration

- Base URL configured via `BASE_URL` environment variable (defaults to `https://mixpla.io`)
- Tests run headless by default
- Uses Chromium browser
- Results saved to HTML report
