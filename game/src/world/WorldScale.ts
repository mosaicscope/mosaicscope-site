// The survey uses two metres per ground tile and 16 vertical screen pixels per metre.
import {BONES,HEAD_R} from '../render/StickFigure';
export const ADULT_METRES=1.75;
export const MAPPED_FIGURE_SCALE=16*ADULT_METRES/(BONES.HIP+BONES.TORSO+BONES.NECK+HEAD_R);
