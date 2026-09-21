// Google Apps Script web app for the public application counter.
// The appsscript.json manifest limits Gmail access to read-only.
const JOB_LABEL = 'job';
const LAUNCH_DATE = '2026-09-17';
const BASELINE = 412;
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function doGet(event) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty('STATS_TOKEN');
  if (!expectedToken || !event || event.parameter.token !== expectedToken) {
    return jsonResponse_({ error: 'Unauthorized' });
  }

  const label = gmailApi_('/labels').labels.find(item => item.name.toLowerCase() === JOB_LABEL.toLowerCase());
  if (!label) return jsonResponse_({ error: `Missing Gmail label: ${JOB_LABEL}` });

  const labelDetails = gmailApi_(`/labels/${encodeURIComponent(label.id)}`);
  const timeZone = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd');
  const dailyCounts = {};
  const threadIds = listThreadIds_(label.id);
  const token = ScriptApp.getOAuthToken();

  for (let start = 0; start < threadIds.length; start += 100) {
    const requests = threadIds.slice(start, start + 100).map(threadId => ({
      url: `${GMAIL_API}/threads/${encodeURIComponent(threadId)}?format=minimal&fields=messages%2FinternalDate`,
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true,
    }));
    UrlFetchApp.fetchAll(requests).forEach(response => {
      if (response.getResponseCode() !== 200) throw new Error(`Gmail API returned ${response.getResponseCode()}`);
      const thread = JSON.parse(response.getContentText());
      const lastMessageTime = Math.max(...thread.messages.map(message => Number(message.internalDate)));
      const date = Utilities.formatDate(new Date(lastMessageTime), timeZone, 'yyyy-MM-dd');
      if (date >= LAUNCH_DATE) dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });
  }

  const days = Object.keys(dailyCounts)
    .filter(date => date !== today && dailyCounts[date] > 0)
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({ date, count: dailyCounts[date], isToday: false }));
  days.unshift({ date: today, count: dailyCounts[today] || 0, isToday: true });

  return jsonResponse_({ total: Math.max(BASELINE, labelDetails.threadsTotal || 0), days });
}

function authorizeGmail() {
  gmailApi_('/labels?fields=labels(id,name)');
}

function listThreadIds_(labelId) {
  const ids = [];
  let pageToken = '';
  do {
    const query = `?labelIds=${encodeURIComponent(labelId)}&q=${encodeURIComponent('after:2026/09/16')}&maxResults=100&fields=nextPageToken%2Cthreads%2Fid${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const page = gmailApi_(`/threads${query}`);
    (page.threads || []).forEach(thread => ids.push(thread.id));
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return ids;
}

function gmailApi_(path) {
  const response = UrlFetchApp.fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error(`Gmail API returned ${response.getResponseCode()}: ${response.getContentText()}`);
  return JSON.parse(response.getContentText());
}

function jsonResponse_(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
