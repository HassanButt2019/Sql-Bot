export function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => (
    typeof val === 'bigint' ? val.toString() : val
  ));
}
