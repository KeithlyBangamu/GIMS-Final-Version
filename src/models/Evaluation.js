import mongoose from 'mongoose';

const ratingField = { type: Number, min: 1, max: 5 };

const EvaluationSchema = new mongoose.Schema(
  {
    registrationID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Registration',
      required: true,
    },
    seminarID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seminar',
      required: true,
    },
    employeeID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    ratings: {
      overall: { ...ratingField, required: true },
      relevance: ratingField,
      facilitator: ratingField,
      organization: ratingField,
      interaction: ratingField,
      food: ratingField,
      venue: ratingField,
      understanding: ratingField,
      applyLikelihood: ratingField,
    },
    responses: {
      relevanceContext: { type: String, trim: true, default: '' },
      lessons: [
        {
          referenceLabel: { type: String, trim: true, default: '' },
          referenceShortName: { type: String, trim: true, default: '' },
          answer: { type: String, trim: true, default: '' },
        },
      ],
      stop: { type: String, trim: true, default: '' },
      start: { type: String, trim: true, default: '' },
      continueDoing: { type: String, trim: true, default: '' },
      improvements: { type: String, trim: true, default: '' },
    },
    consent: { type: Boolean, default: false },
    acknowledgement: { type: Boolean, default: false },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

EvaluationSchema.index({ seminarID: 1, employeeID: 1 }, { unique: true });

export default mongoose.model('Evaluation', EvaluationSchema);
