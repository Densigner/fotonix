const admin = require('./firebase-admin');

const BUCKET_NAME = 'fotonix-97544.firebasestorage.app';
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // keep combined payload under the 20mb JSON body limit

/**
 * Upload one attachment's raw bytes to Firebase Storage and return metadata
 * (filename, contentType, size, url, buffer). The buffer is kept in the
 * returned object so callers (nodemailer) can attach the real file inline
 * without re-downloading it from storage.
 */
async function uploadAttachment({ filename, contentType, buffer }, messageKey) {
  if (!buffer || buffer.length === 0) {
    throw new Error(`Attachment "${filename}" has no content`);
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment "${filename}" is too large (${Math.round(buffer.length / 1024 / 1024)}MB, max 15MB)`);
  }

  const safeName = String(filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `email-attachments/${messageKey}/${Date.now()}-${safeName}`;
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const file = bucket.file(storagePath);

  await file.save(buffer, { contentType: contentType || 'application/octet-stream' });
  await file.makePublic();

  return {
    filename: filename || safeName,
    contentType: contentType || 'application/octet-stream',
    size: buffer.length,
    url: `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
    buffer
  };
}

/**
 * Upload a batch of attachments (array of { filename, contentType, dataBase64 }
 * as received over HTTP). Returns the uploaded metadata array.
 */
async function uploadAttachments(rawAttachments, messageKey) {
  if (!Array.isArray(rawAttachments) || rawAttachments.length === 0) return [];

  const uploaded = [];
  for (const att of rawAttachments) {
    const buffer = Buffer.from(att.dataBase64 || '', 'base64');
    const result = await uploadAttachment({ filename: att.filename, contentType: att.contentType, buffer }, messageKey);
    uploaded.push(result);
  }
  return uploaded;
}

module.exports = { uploadAttachment, uploadAttachments, MAX_ATTACHMENT_BYTES };
