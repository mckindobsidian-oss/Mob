// Field-level acknowledgements preserve edits made while an earlier request is in flight.
export function settingsQueue(storage, uid) {
  const key="mob:settings-queue:"+uid;
  function read() {
    try { return JSON.parse(storage.getItem(key)||"{}"); }
    catch { return {}; }
  }
  return {
    add(patch) {
      const entries=read();
      for (const [field,value] of Object.entries(patch)) entries[field]={ value, id: crypto.randomUUID() };
      storage.setItem(key,JSON.stringify(entries));
    },
    snapshot: read,
    values(entries=read()) {
      return Object.fromEntries(Object.entries(entries).map(([key,record])=>[key,record.value]));
    },
    acknowledge(sent) {
      const entries=read();
      for (const [field,record] of Object.entries(sent)) if (entries[field]?.id===record.id) delete entries[field];
      storage.setItem(key,JSON.stringify(entries));
    }
  };
}
