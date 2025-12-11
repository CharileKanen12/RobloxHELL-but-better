Integrate Rotector's AI-powered safety detection system into your own applications. This API provides access to user analysis data, flag types, confidence scores, and detailed violation reasoning.

#### Authentication

No authentication required. This is a fully public API.

#### HTTP Status Codes

Return HTTP status 200 for all successful requests (including non-flagged users with flagType 0). Error responses with other status codes (4xx, 5xx) only occur for internal server errors or backend issues.

#### CORS Support

The API includes CORS headers that allow requests from all origins.

#### Single User Lookup

GET `https://roscoe.robalyx.com/v1/lookup/roblox/user/{userId}`

##### Example Request

```
GET https://roscoe.robalyx.com/v1/lookup/roblox/user/1234567890
```

##### Code Examples

JS TS Python Go Lua

```
async function checkUser(userId) {
  const response = await fetch(
    `https://roscoe.robalyx.com/v1/lookup/roblox/user/${userId}`
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

// Usage
try {
  const user = await checkUser(1234567890);
  console.log('Flag Type:', user.flagType);
  console.log('Confidence:', user.confidence);
} catch (error) {
  console.error('Error checking user:', error);
}
```

##### Success Response

```
{
  "success": true,
  "data": {
    "id": 1234567890,
    "flagType": 2,
    "confidence": 0.95,
    "reasons": {
      "Inappropriate Content": {
        "message": "The user profile contains content that violates platform safety guidelines",
        "confidence": 0.9,
        "evidence": [
          "Evidence item 1",
          "Evidence item 2"
        ]
      },
      "Network Analysis": {
        "message": "This account demonstrates patterns of associating with flagged accounts",
        "confidence": 0.85,
        "evidence": null
      }
    },
    "reviewer": {
      "username": "system_reviewer",
      "displayName": "System Reviewer"
    },
    "engineVersion": "2.17",
    "versionCompatibility": "compatible",
    "lastUpdated": 1762158166
  }
}
```

##### Error Response

Return HTTP status 200 for all successful requests (including non-flagged users with flagType 0). Error responses with other status codes (4xx, 5xx) only occur for internal server errors or backend issues.

```
{
  "success": false,
  "error": "Internal server error"
}
```

#### Batch User Lookup

POST `https://roscoe.robalyx.com/v1/lookup/roblox/user`

Check multiple users in a single request. Maximum 100 users per batch.

Maximum 100 user IDs per batch request. Requests exceeding this limit will return an error.

##### Request Body

```
{
  "ids": [
    1234567890,
    9876543210,
    5555555555
  ]
}
```

##### Code Examples

JS TS Python Go Lua

```
async function checkMultipleUsers(userIds) {
  const response = await fetch(
    'https://roscoe.robalyx.com/v1/lookup/roblox/user',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids: userIds })
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

// Usage
try {
  const users = await checkMultipleUsers([1234567890, 9876543210]);

  for (const [userId, userData] of Object.entries(users)) {
    console.log(`User ${userId}: Flag Type ${userData.flagType}`);
  }
} catch (error) {
  console.error('Error checking users:', error);
}
```

##### Success Response

```
{
  "success": true,
  "data": {
    "1234567890": {
      "id": 1234567890,
      "flagType": 2,
      "confidence": 0.95,
      "reasons": {
        "Risk Pattern": {
          "message": "Account exhibits concerning behavioral patterns",
          "confidence": 0.9,
          "evidence": null
        }
      },
      "engineVersion": "2.25",
      "versionCompatibility": "current",
      "lastUpdated": 1761358239
    },
    "9876543210": {
      "id": 9876543210,
      "flagType": 0
    },
    "5555555555": {
      "id": 5555555555,
      "flagType": 1,
      "confidence": 0.65
    }
  }
}
```

Users not found in the database will not appear in the response. The data field contains an object where keys are user IDs (as strings) and values are user status objects.

All requested users are returned in the response. Users not yet analyzed or not in the system will have flagType 0 (Safe).

#### Response Schema

##### Required Fields

- `id` - User ID (integer) - Roblox user identifier
- `flagType` - Flag type (0-6) - Safety classification level

##### Optional Fields

- `confidence` - Confidence score (0.0-1.0) - AI model's certainty level
- `reasons` - Object containing detailed violation analysis (omitted when flagType=0)
    - `message` - Detailed explanation of the violation pattern
    - `confidence` - Confidence score for this specific reason
    - `evidence` - Array of evidence strings or null if no direct evidence
- `reviewer` - Information about the reviewer who verified the flag
    - `username` - Reviewer's username
    - `displayName` - Reviewer's display name
- `engineVersion` - Version of the analysis engine used
- `versionCompatibility` - Compatibility status: 'current', 'compatible', or 'outdated'
- `lastUpdated` - Unix timestamp of last analysis update

##### Flag Types

- `0` - Safe - No concerning patterns detected
- `1` - Pending - User is queued for analysis
- `2` - Unsafe - Violates platform safety guidelines
- `3` - Queued - Submitted for review
- `4` - Integration - Related to API integration features
- `5` - Mixed - Contains both safe and unsafe signals
- `6` - Past Offender - Previously flagged but status changed

##### Field Presence Rules

- `confidence` - Present when user is flagged (flagType > 0)
- `reasons` - Present for flagged, mixed, or confirmed users (flagType 1, 2, 5, 6)
- `reviewer` - Present only for confirmed users (flagType 2) verified by human moderators
- `versionCompatibility` - Indicates whether the AI engine version used was latest or outdated

#### Rate Limiting & Best Practices

##### Rate Limiting

- The API uses Cloudflare rate limiting to ensure fair usage
- Rate limit errors return HTTP status 429. Implement exponential backoff for retry logic

##### Batch Request Recommendations

- Use batch endpoints when checking multiple users (more efficient than multiple single requests)
- Keep batch sizes under 100 users per request
- Add delays between consecutive batch requests (recommended: 250ms minimum)

##### Error Handling

- Always check the success field in responses
- Handle network errors gracefully with appropriate retry logic
- Log error details for debugging (error message, HTTP status, request ID if available)

##### Response Times

Best case: ~50ms. Average: ~200ms. Consider implementing appropriate timeout values based on these benchmarks.

#### Additional Notes

##### HTTPS Required

All API requests must use HTTPS. HTTP requests will be rejected.

##### Response Wrapper Format

All API responses follow a consistent wrapper format with success (boolean) and either data (success) or error (failure) fields.

##### Response Caching

Consider implementing client-side caching for user status data. The lastUpdated timestamp indicates when the analysis was last performed and can be used to determine cache freshness.

##### Safe User Optimization

For users with flagType 0 (Safe), the reasons field is automatically cleared to reduce response size. No detailed violation analysis is provided for safe users.

##### Support & Questions

For API support, questions, or to report issues, join the Rotector Discord server:

##### Timestamp Format

The lastUpdated field contains Unix timestamp in seconds (not milliseconds).

##### Version Compatibility Values

- `current` - current - Analysis used the latest AI engine version
- `compatible` - compatible - Analysis used a supported but not latest engine version
- `outdated` - outdated - Analysis used a significantly older engine version
- `deprecated` - deprecated - Analysis used an engine version no longer supported
