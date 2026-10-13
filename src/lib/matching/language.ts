// CJK Unified Ideographs (+ Extension A) and CJK punctuation.
const CJK = /[　-〿㐀-䶿一-鿿豈-﫿]/;

/** Search language for a query: Chinese if it contains any CJK character. */
export function detectQueryLanguage(text: string): "zh-CN" | "en" {
  return CJK.test(text) ? "zh-CN" : "en";
}
