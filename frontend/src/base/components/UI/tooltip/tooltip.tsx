import "./tooltip.css";

export enum TooltipPosition {
    TOP,
    BOTTOM,
    LEFT,
    RIGHT
}

export const Tooltip: React.FC<{text: string, position: TooltipPosition}> = ({text, position}) => {
    return (
        <span className="tooltip" data-position={TooltipPosition[position].toLowerCase()}>
            {text}
        </span>
    );
};