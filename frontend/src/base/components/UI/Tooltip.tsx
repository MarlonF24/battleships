import styled from 'styled-components';

export enum TooltipPosition { TOP, BOTTOM, LEFT, RIGHT }

interface TooltipProps {
  $pos: TooltipPosition;
}

const POS_MAP: Record<TooltipPosition, any> = {
  [TooltipPosition.TOP]:    { inset: 'auto auto 100% 50%', transform: 'translate(-50%, -8px)',  arrow: { top: '100%', left: '50%', transform: 'translateX(-50%)', borderTopColor: 'var(--bg)' }},
  [TooltipPosition.BOTTOM]: { inset: '100% auto auto 50%', transform: 'translate(-50%, 8px)',   arrow: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', borderBottomColor: 'var(--bg)' }},
  [TooltipPosition.LEFT]:   { inset: '50% 100% auto auto', transform: 'translate(-8px, -50%)',  arrow: { top: '50%', left: '100%', transform: 'translateY(-50%)', borderLeftColor: 'var(--bg)' }},
  [TooltipPosition.RIGHT]:  { inset: '50% auto auto 100%', transform: 'translate(8px, -50%)',   arrow: { top: '50%', right: '100%', transform: 'translateY(-50%)', borderRightColor: 'var(--bg)' }},
};

const TooltipContainer = styled.span.attrs({ className: 'tooltip' })<TooltipProps>((props) => ({
  '--bg': 'var(--text-color, #333)',
  position: 'absolute',
  zIndex: 10,
  width: 'max-content',
  maxWidth: '180px',
  padding: '0.5rem 1rem',
  background: 'var(--bg)',
  color: '#fff',
  borderRadius: '6px',
  fontSize: '0.70rem',
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  pointerEvents: 'none',
  whiteSpace: 'pre-line',
  opacity: 0,
  visibility: 'hidden',
  transition: 'opacity 0.18s, visibility 0.18s',


  inset: POS_MAP[props.$pos].inset,
  transform: POS_MAP[props.$pos].transform,

  '&::after': {
    content: '""',
    position: 'absolute',
    border: '6px solid transparent',
    ...POS_MAP[props.$pos].arrow
  },

  "*:has(> &)": {
    position: "relative",
  },

  "*:has(> &):hover &" : {
      opacity: 0.92,
      visibility: "visible",
  }

}));

export const Tooltip: React.FC<{ text: string; position: TooltipPosition }> = ({ text, position }) => (
  <TooltipContainer $pos={position}>
    {text}
  </TooltipContainer>
);