(function defineAIOfficeOcrTimeoutContract(root) {
  const ocr = Object.freeze({ timeoutMs: 120000, unit: 'milliseconds' });
  const contract = Object.freeze({ ocr });
  if (typeof module !== 'undefined' && module.exports) module.exports = contract;
  if (root) Object.defineProperty(root, 'AIOfficeContracts', { value: contract, writable: false, configurable: false, enumerable: false });
})(typeof globalThis !== 'undefined' ? globalThis : this);
