export type Plan = {
  hairProfile?: string; skinProfile?: string; browProfile?: string; beardProfile?: string;
  lockedFeatures?: string[]; barberInstructions?: string[]; skincareRoutine?: string[];
  browAndBeardPlan?: string[]; actionChecklist?: string[];
};
export type Session = { id:string; createdAt:string; original:string; result:string; plan:Plan };
export type Rule = { id:string; title:string; instruction:string; enabled:boolean; source:string };
export type CaseItem = {
  id:string; name:string; before:string; realAfter:string; notes:string;
  prediction?:string; plan?:Plan;
  scores?:{identityLockScore:number;hairBeardAccuracyScore:number;realismScore:number;overallSimilarityScore:number;critique:string};
  userScore?:number; userFeedback?:string; isGoldenExample?:boolean;
};
