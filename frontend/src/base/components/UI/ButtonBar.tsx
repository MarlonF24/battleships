import React, {CSSProperties} from "react";

const style: CSSProperties = {
	display: "flex",
	gap: "16px",
	marginBottom: "24px",
	flexWrap: "wrap",
	justifyContent: "center",
}

export const ButtonBar = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="button-bar" style={style}>
            {children}
        </div>
    )
}