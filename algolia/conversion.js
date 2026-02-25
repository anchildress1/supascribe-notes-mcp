/**
 * This is the default javascript transformation function, you cannot rename it or change its signature.
 * This function will be called for each item in the dataset.
 * @param {SourceRecord} record - Represent one item from your dataset - Type is inferred from the input record.
 * @param {Helper} helper - Use it to reference Secrets and get Metadata.
 * @returns {SourceRecord|Array<SourceRecord>|undefined} - Return a record, an array of records, or undefined to skip.
 */
async function transform(record, helper) {
  // Keep runtime signature stable for Algolia even when helper is not needed.
  const _helperPresent = typeof helper?.getMetadata === 'function';

  if (record.deleted_at) return undefined;

  const toStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  // Accept legacy input shapes, emit canonical dot-notation fields only.
  const rawLvl0 =
    record?.tags?.lvl0 ?? record?.tags?.['tags.lvl0'] ?? record['tags.lvl0'] ?? record.lvl0 ?? [];
  const rawLvl1 =
    record?.tags?.lvl1 ?? record?.tags?.['tags.lvl1'] ?? record['tags.lvl1'] ?? record.lvl1 ?? [];

  record['tags.lvl0'] = toStringArray(rawLvl0);
  record['tags.lvl1'] = toStringArray(rawLvl1);
  delete record.tags;
  delete record.lvl0;
  delete record.lvl1;

  const createdMs = Date.parse(record.created_at);
  if (!Number.isNaN(createdMs)) {
    record.created_at_epoch = Math.floor(createdMs / 1000);
  }

  const updatedMs = Date.parse(record.updated_at);
  if (!Number.isNaN(updatedMs)) {
    record.updated_at_epoch = Math.floor(updatedMs / 1000);
  }

  return record;
}
globalThis.transform = transform;
