import mongoose from 'mongoose';
import { getSchoolYear } from '../services/schoolYearService.js';

const SeminarSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    location: { type: String, trim: true, default: '' },
    resourcePerson: { type: String, trim: true, default: '' },
    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // e.g. "14:00"
    durationHours: { type: Number, required: true, min: 0.5 },
    mandatory: { type: Boolean, default: false },
    capacity: { type: Number, required: true, min: 1 },
    isHeld: { type: Boolean, default: false },
    heldAt: { type: Date },
    sessions: [
      {
        date: { type: Date, required: true },
        startTime: { type: String, required: true },
        durationHours: { type: Number, required: true, min: 0.5 },
        isHeld: { type: Boolean, default: false },
        heldAt: { type: Date },
      },
    ],
    registeredEmployees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
      },
    ],
    materials: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LearningMaterial',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
    autoSendCertificates: {
      type: Boolean,
      default: false,
    },
    certificateReleaseMode: {
      type: String,
      enum: ['manual', 'evaluation', 'automatic'],
      default: 'evaluation',
    },
    requiredSessionsToPass: {
      type: Number,
      default: null,
      min: 1,
    },
    multiSessionType: {
      type: String,
      enum: ['all', 'pick-one'],
      default: 'all',
    },
    evaluationTopic: { type: String, trim: true, default: '' },
    evaluationReferences: [
      {
        label: { type: String, trim: true, default: '' },
        shortName: { type: String, trim: true, default: '' },
      },
    ],
    schoolYear: { type: String, trim: true, default: null, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletePermanentlyAt: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

SeminarSchema.pre('validate', function autoSchoolYear(next) {
  if (!this.schoolYear && this.date) {
    this.schoolYear = getSchoolYear(this.date);
  }
  next();
});

export default mongoose.model('Seminar', SeminarSchema);

