import mongoose from 'mongoose';

const MaintenanceLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'school-year-reset',
        'school-year-restore',
        'attendance-import',
        'snapshot-create',
        'snapshot-restore',
      ],
      index: true,
    },
    schoolYear: { type: String, required: true, index: true },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    triggeredByName: { type: String },
    triggeredByEmail: { type: String },
    triggeredAt: { type: Date, default: Date.now },
    counts: {
      registrationsArchived: { type: Number, default: 0 },
      seminarsArchived: { type: Number, default: 0 },
      employeesAffected: { type: Number, default: 0 },
      registrationsRestored: { type: Number, default: 0 },
      seminarsRestored: { type: Number, default: 0 },
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('MaintenanceLog', MaintenanceLogSchema);
