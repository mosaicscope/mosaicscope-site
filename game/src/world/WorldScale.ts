// Surveyed ground, cars, people and building heights share two metres per world unit.
import {Z_PX} from './iso';
export const METRES_PER_TILE=2;
export const MAPPED_HEIGHT_RATIO=Z_PX/(METRES_PER_TILE*16);
import {BONES,HEAD_R} from '../render/StickFigure';
export const ADULT_METRES=1.75;
export const MAPPED_FIGURE_SCALE=(Z_PX/METRES_PER_TILE)*ADULT_METRES/(BONES.HIP+BONES.TORSO+BONES.NECK+HEAD_R);
