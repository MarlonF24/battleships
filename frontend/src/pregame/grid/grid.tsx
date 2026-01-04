import React, { EventHandler, useRef } from "react";

import { ShipInEvent } from "../utility/suggestion_handler";
import "./grid.css";



export class Grid  {
	constructor(readonly rows: number, readonly cols: number) {}
	
	public readonly Renderer = ({shipInHandler}: {shipInHandler: EventListener}) => {
		const tbodyRef = useRef<HTMLTableSectionElement>(null);

		React.useEffect(() => {
			const tbody = tbodyRef.current!;
			
			tbody.addEventListener("ship-in", shipInHandler);
			return () => {
				tbody.removeEventListener("ship-in", shipInHandler);
			}
		}, [shipInHandler]);

		return (<table className="grid">
			<tbody ref={tbodyRef}>
				{Array.from({ length: this.rows }, (_, r) => (
					<tr key={r}>
						{Array.from({ length: this.cols }, (_, c) => (
							<td key={`${r}-${c}`} className="cell" />
						))}
					</tr>
				))}
			</tbody>
		</table>
		);
	}
};
