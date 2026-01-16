# Tracking Function: Firestore schema and deployment guide

This document describes the Firestore collections, example document shapes, and deployment guidance for the click/open tracking system implemented by `functions/index.js` and `functions/trackingToken.js`.

## Collections and example documents

### tracked_links
Stores configuration for tracked links (destination URLs and optional metadata).

Example document (doc id = linkId):

{
  "destination": "https://your-site.com/landing-page",
  "url": "https://your-site.com/landing-page", // alias
  "title": "Spring campaign CTA",
  "createdAt": "serverTimestamp()",
  "createdBy": "admin@example.com",
}

Fields:
- destination, url (string): final redirect target
- title (string, optional): human-friendly label
- createdAt (timestamp)
- createdBy (string, optional)

---

### link_clicks
Individual click events for tracked links (one document per click).

Example:

{
  "tracked_link_id": "demo-link-123",
  "recipient_id": "user-456@example.com",
  "occurred_at": "serverTimestamp()",
  "ip": "203.0.113.5",
  "user_agent": "Mozilla/5.0 (...)",
  "referer": "https://mail-service.example/",
  "is_suspected_bot": false,
  "meta": { "utm_source": "newsletter" }
}

Fields:
- tracked_link_id (string): linkId used when generating the token
- recipient_id (string): identifier for the recipient
- occurred_at (timestamp)
- ip (string, optional)
- user_agent (string, optional)
- referer (string, optional)
- is_suspected_bot (boolean)
- meta (object, optional): any additional query params or metadata

---

### link_aggregates
Per-link aggregate counters. Documents keyed by linkId.

Example (doc id = demo-link-123):

{
  "clickCount": 42,
  "uniqueCount": 17,
  "updatedAt": "serverTimestamp()"
}

Fields:
- clickCount (number): total clicks (incremented on each click)
- uniqueCount (number): unique recipient clicks (incremented once per recipient)
- updatedAt (timestamp, optional)

---

### link_unique
Dedupe collection for unique clicks. Stores one doc per linkId+recipientId to ensure uniqueCount increments only once.
Doc id format: `${linkId}_${recipientId}` (make sure recipientId is sanitized/URL-safe if stored as id)

Example doc:

{
  "linkId": "demo-link-123",
  "recipientId": "user-456@example.com",
  "createdAt": "serverTimestamp()"
}

Fields:
- linkId (string)
- recipientId (string)
- createdAt (timestamp)

---

### email_opens
Open events recorded when the pixel endpoint is hit.

Example:

{
  "tracked_link_id": "demo-link-123",
  "recipient_id": "user-456@example.com",
  "occurred_at": "serverTimestamp()",
  "ip": "203.0.113.5",
  "user_agent": "AppleWebKit/...",
  "referer": null,
  "is_suspected_bot": false,
  "meta": { }
}

Fields match `link_clicks` semantics above.

---

## Security rules guidance

These collections contain sensitive telemetry and should only be written by trusted server code (Cloud Functions) and not directly by client-side apps. Recommended approach:

- Deny client-side writes and reads by default.
- Allow server SDKs (Cloud Functions) to write via the Admin SDK which bypasses security rules.

Example Firestore rules snippet (restrict clients):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // tracked_links: allow read for clients if you publish public links, otherwise restrict
    match /tracked_links/{linkId} {
      allow read: if false; // or add a condition for authenticated admin users
      allow write: if false;
    }

    // Prevent clients from writing telemetry collections
    match /link_clicks/{docId} {
      allow read, write: if false;
    }

    match /link_aggregates/{docId} {
      allow read, write: if false;
    }

    match /link_unique/{docId} {
      allow read, write: if false;
    }

    match /email_opens/{docId} {
      allow read, write: if false;
    }

    // Add other rules for your application documents below
  }
}
```

Notes:
- The Admin SDK used by Cloud Functions ignores security rules, so telemetry writes from `functions/index.js` will succeed.
- If you need to expose certain reads to admin users via client apps, implement a secure API endpoint that verifies the caller and returns aggregated data rather than allowing direct client reads.

## Runtime config and deploy

Set HMAC secret used for signing/verification:

```bash
firebase functions:config:set tracking.secret="YOUR_SECRET"
```

Deploy functions and hosting rewrites (if configured in `firebase.json`):

```bash
firebase deploy --only functions,hosting
```

Ensure your `firebase.json` includes hosting rewrites to route tracking URLs to the function, for example:

```json
{
  "hosting": {
    "rewrites": [
      { "source": "/r/**", "function": "tracking" },
      { "source": "/o/pixel", "function": "tracking" }
    ]
  }
}
```

## Privacy and compliance notes

- Collect only the data you need. IP addresses and user agents can be personal data in some jurisdictions. Consider hashing or truncating IPs if full IPs are not needed.
- Respect unsubscribe and privacy preferences; do not use tracking for recipients who opted out.
- Retention: implement policies to delete or aggregate old telemetry records to meet retention requirements.

---

If you'd like, I can also generate a small Rules test or a script to seed a `tracked_links` document for testing. Let me know which you'd prefer next.
