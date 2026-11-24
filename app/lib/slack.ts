// Slack calls for the login code, using the "Orders team reviewer" bot.
// Bot token scopes needed: users:read.email (find the person) and chat:write (DM them).

async function slack(method: string, body: Record<string, string>) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN is not set.');
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  });
  return res.json();
}

// Active, full member of the workspace whose Slack email matches exactly; otherwise null.
export async function findSlackUser(email: string): Promise<string | null> {
  const data = await slack('users.lookupByEmail', { email });
  if (!data.ok) {
    if (data.error === 'users_not_found') return null;
    throw new Error(`Slack users.lookupByEmail failed: ${data.error}`);
  }
  const u = data.user;
  if (!u || u.deleted || u.is_bot || u.is_restricted || u.is_ultra_restricted) return null;
  if (String(u.profile?.email ?? '').toLowerCase() !== email) return null;
  return u.id as string;
}

export async function sendCodeDM(userId: string, code: string): Promise<void> {
  const text =
    `Your Hotel Health Monitor sign-in code is *${code}*.\n` +
    `It expires in 10 minutes. If you didn't request it, ignore this message.`;
  const data = await slack('chat.postMessage', { channel: userId, text });
  if (!data.ok) throw new Error(`Slack chat.postMessage failed: ${data.error}`);
}
