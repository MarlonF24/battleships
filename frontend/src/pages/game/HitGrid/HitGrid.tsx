
export const HitGrid =  ({grid}: {grid: boolean[][]}) => {
        return (
            <table className="hit-grid grid">
                <tbody>
                    {grid.map((row, r) => (
                        <tr key={r}>
                            {row.map((cell, c) => (
                                <td key={`${r}-${c}`}>
                                    {cell && <HitCross />}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }

export default HitGrid;

const HitCross = () => (
    <svg className="red-x" viewBox={`0 0 24 24`}>
        <line x1="0" y1="0" x2={24} y2={24} stroke="red" strokeWidth={24 / 12} />
        <line x1={24} y1="0" x2="0" y2={24} stroke="red" strokeWidth={24 / 12} />
    </svg>
);