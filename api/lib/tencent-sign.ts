import crypto from "crypto";

function sha256(message: string): string {
  return crypto.createHash("sha256").update(message).digest("hex");
}

function hmacSha256(key: string | Buffer, message: string): Buffer {
  return crypto.createHmac("sha256", key).update(message).digest();
}

export function signTencentRequest(params: {
  secretId: string;
  secretKey: string;
  service: string;
  host: string;
  payload: string;
  action: string;
  version: string;
  region?: string;
}) {
  const {
    secretId,
    secretKey,
    service,
    host,
    payload,
    action,
    version,
    region = "ap-guangzhou",
  } = params;

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  // 1. 构造规范请求
  const httpMethod = "POST";
  const canonicalUri = "/";
  const canonicalQueryString = "";
  const contentType = "application/json";
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const signedHeaders = "content-type;host";
  const hashedPayload = sha256(payload);
  const canonicalRequest = `${httpMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`;

  // 2. 构造待签名字符串
  const algorithm = "TC3-HMAC-SHA256";
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`;

  // 3. 计算签名
  const secretDate = hmacSha256("TC3" + secretKey, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = crypto
    .createHmac("sha256", secretSigning)
    .update(stringToSign)
    .digest("hex");

  // 4. 构造 Authorization
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, timestamp, region };
}
