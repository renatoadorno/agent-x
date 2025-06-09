export async function getRules() {
  try {
    const filePath = "/Users/renatoadorno/cli/jarvis-rules.md"
    const file = Bun.file(filePath);
    const content = await file.text();
    return content;
  } catch(err) {
    return ""
  }
}