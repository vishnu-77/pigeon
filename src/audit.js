export class AuditLog {
  constructor() {
    this.records = [];
  }

  write(type, details) {
    const record = {
      id: `audit_${this.records.length + 1}`,
      type,
      time: new Date().toISOString(),
      ...details
    };
    this.records.push(record);
    return record;
  }

  all() {
    return [...this.records];
  }

  bySubject(subject) {
    return this.records.filter((record) => record.subject === subject);
  }
}
