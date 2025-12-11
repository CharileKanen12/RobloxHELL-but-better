import { readFileSync, writeFileSync } from "fs";
import { flagTypeToEnum, flagTypeToString, type UserStatus } from "./rotector";

const stuff = JSON.parse(
	readFileSync("d/output.json") as any as string
) as any as Record<string, UserStatus>;

let newV: Record<string, UserStatus> = {};

let vD: Record<string, number> = {};

let vI: Record<string, string[]> = {};

for (const [skidId, skid] of Object.entries(stuff)) {
	const fT = flagTypeToEnum(skid.flagType);
	const DT = `${flagTypeToString(fT)} (${fT})`;
	if (!vD[DT]) {
		vD[DT] = 1;
	} else {
		vD[DT]! += 1;
	}
	if (!vI[DT]) {
		vI[DT] = [skid.id.toString()];
	} else {
		vI[DT].push(skid.id.toString());
	}
	if (skid.flagType !== 0) {
		Object.assign(newV, {
			[skidId]: skid
		});
	}
}

console.log(vD);

console.log(
	Object.entries(vI)
		.filter(([a, b]) => a !== "SAFE (0)")
		.map(([a, b]) => `${a} - ${b.join(", ")}`)
		.join("\n")
);

writeFileSync("d/outputF.json", JSON.stringify(newV, undefined, "\t"));
