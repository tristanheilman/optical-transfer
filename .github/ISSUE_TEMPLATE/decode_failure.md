---
name: Decode failure
about: A transfer did not reconstruct the file
title: ''
labels: bug
---

**Which path failed?**

- [ ] GIF — "Share as GIF" in the example app
- [ ] GIF — the hosted web viewer
- [ ] Live screen-to-camera

**What happened**

What you expected, and what you got instead. Paste the exact error text if there was one.

**Payload**

- Size in bytes:
- Type (text / image / binary):
- `blockLen`, if you changed it from the default:

**Reproducibility**

- [ ] Fails every time with this file
- [ ] Intermittent

If you can pin a `sessionId` that reproduces it, put it here — that is the most
useful single detail in this form.

**Devices** (live camera path only)

- Sending device and OS:
- Receiving device and OS:

**Package versions**

Output of `npm ls @optical-transfer/core @optical-transfer/gif`, or the version
of the app you were using.

**Attachments**

If it is the GIF path and you can share the GIF, attach it.
