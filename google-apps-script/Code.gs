/**
 * Free transactional email relay for the barber app.
 * Deploy as a Web App that executes as the Google account owner.
 * Keep WEBHOOK_SECRET in Script Properties; never put it in browser code.
 */
function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const expected = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
    if (!expected || request.secret !== expected) return output({ error: "unauthorized" }, 401);
    if (!Array.isArray(request.messages) || request.messages.length > 2) {
      return output({ error: "invalid_messages" }, 400);
    }

    const remaining = MailApp.getRemainingDailyQuota();
    if (remaining < request.messages.length) return output({ error: "daily_quota_exceeded" }, 429);

    for (const message of request.messages) {
      if (!message || !isEmail(message.to) || typeof message.subject !== "string" || typeof message.text !== "string") {
        return output({ error: "invalid_message" }, 400);
      }
    }
    for (const message of request.messages) {
      MailApp.sendEmail({
        to: message.to,
        subject: message.subject.slice(0, 180),
        body: message.text.slice(0, 8000),
        name: "Agenda da Barbearia",
      });
    }
    return output({ sent: request.messages.length, remaining: MailApp.getRemainingDailyQuota() });
  } catch (error) {
    console.error(error);
    return output({ error: "send_failed" }, 500);
  }
}

function isEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function output(value, status) {
  return ContentService.createTextOutput(JSON.stringify({ ...value, status: status || 200 }))
    .setMimeType(ContentService.MimeType.JSON);
}
