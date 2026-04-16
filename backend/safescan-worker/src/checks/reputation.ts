import { Env, ThreatMatch, SafeBrowsingResponse } from '../utils/types';
import { parseDuration } from '../utils/parseDuration';
import { CheckResult } from '../utils/types';

// Tier 2 (external API, 200-400ms)
// checkReputation queries Google Safe Browsing and maps result to CheckResult
// TODO: preserve behavior exactly from previous implementation
export async function checkReputation(url: string, env: Env): Promise<{ checkResult: CheckResult; ttl: number }> {
  let response: Response;

  try {
    response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${env.SAFE_BROWSING_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'safescan-app', clientVersion: '1.0.0' },
          threatInfo: {
            threatTypes: [
              'MALWARE',
              'SOCIAL_ENGINEERING',
              'UNWANTED_SOFTWARE',
              'POTENTIALLY_HARMFUL_APPLICATION',
            ],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      }
    );
  } catch (err) {
    return {
      checkResult: {
        checkName: 'reputation',
        threatLevel: 'unknown',
        score: -1,
        detail: 'Network error reaching Safe Browsing API',
      },
      ttl: 0,
    };
  }

  if (!response.ok) {
    return {
      checkResult: {
        checkName: 'reputation',
        threatLevel: 'unknown',
        score: -1,
        detail: `Safe Browsing API returned status ${response.status}`,
      },
      ttl: 0,
    };
  }

  const data = (await response.json()) as SafeBrowsingResponse;
  const matches = data.matches ?? [];

  if (matches.length === 0) {
    const ttl = parseDuration(data.negativeCacheDuration, 300);
    return {
      checkResult: {
        checkName: 'reputation',
        threatLevel: 'safe',
        score: 10,
        detail: 'No matches in Safe Browsing',
      },
      ttl,
    };
  }

  const ttl = parseDuration(matches[0].cacheDuration, 300);
  const threatTypes = matches.map((m: ThreatMatch) => m.threatType);

  return {
    checkResult: {
      checkName: 'reputation',
      threatLevel: 'malicious',
      score: 90,
      detail: `Threats: ${threatTypes.join(',')}`,
    },
    ttl,
  };
}
