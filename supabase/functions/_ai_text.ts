export function cleanAIText(text: string | null | undefined): string {
  if (!text) return "";

  const protectedUrls: string[] = [];
  const protectedText = text.replace(/https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+|www\.[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+/gi, (url) => {
    protectedUrls.push(url);
    return `__URL_${protectedUrls.length - 1}__`;
  });

  const cleaned = protectedText
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([!?])(?=\S)/gu, "$1 ")
    .replace(/([,;])(?=[^\s\d])/gu, "$1 ")
    .replace(/:(?!\/\/)(?=[^\s\d])/gu, ": ")
    .replace(/\.(?=[A-Za-zÀ-ÿ])/gu, ". ")
    .replace(/([A-Za-zÀ-ÿ])(__URL_\d+__)/gu, "$1 $2")
    .replace(/(__URL_\d+__)(?=[A-Za-zÀ-ÿ])/gu, "$1 ")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return protectedUrls.reduce(
    (result, url, index) => result.replace(`__URL_${index}__`, url),
    cleaned,
  );
}