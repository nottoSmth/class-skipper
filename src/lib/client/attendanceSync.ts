import { singletonFirestore } from "@/lib/client/singleton/client.firebaseAuth";
import { doc, getDocs, setDoc, collection } from "firebase/firestore";
import { decodeAttendance, encodeAttendance } from "@/lib/shared/attendanceCodec";
import { getAttendanceMap, saveAttendanceMap } from "./attendanceStorage";

// ---------- Debounced push ----------
// Tracks one pending timer per (username, monthKey) pair.
// If pushAttendanceMonth is called again before the timer fires, it resets.
const DEBOUNCE_MS = 1500;
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function flushPush(username: string, monthKey: string) {
  try {
    const localMap = getAttendanceMap();
    const result: boolean[][] = [];

    for (let d = 0; d < 31; d++) {
      const day = String(d + 1).padStart(2, "0");
      const dateKey = `${monthKey}-${day}`;
      const dayArr: boolean[] = [];
      const dayLevel = localMap[dateKey] === true;

      for (let p = 0; p < 8; p++) {
        const periodKey = `${dateKey}_p${p + 1}`;
        dayArr.push(localMap[periodKey] === true || dayLevel);
      }
      result.push(dayArr);
    }

    const b64 = encodeAttendance(result);
    const docRef = doc(singletonFirestore, `users/${username}/attendance/${monthKey}`);
    setDoc(docRef, { data: b64, updatedAt: Date.now() }, { merge: true }).catch(
      (err) => console.error("Failed to push attendance:", err)
    );
  } catch (err) {
    console.error("Failed to encode attendance for push:", err);
  }
}

/**
 * Debounced write: schedules a Firestore push for (username, monthKey).
 * Repeated calls within DEBOUNCE_MS reset the timer — only the last
 * state is sent, avoiding a write storm when the user rapidly toggles.
 */
export function pushAttendanceMonth(username: string, monthKey: string) {
  if (!username || !monthKey) return;

  const key = `${username}::${monthKey}`;
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pendingTimers.delete(key);
    flushPush(username, monthKey);
  }, DEBOUNCE_MS);

  pendingTimers.set(key, timer);
}

// ---------- Pull (no debounce needed — only called once on login) ----------

export async function pullAttendanceFromFirestore(username: string) {
  if (!username) return;
  try {
    const colRef = collection(singletonFirestore, `users/${username}/attendance`);
    const snap = await getDocs(colRef);
    const localMap = getAttendanceMap();
    let hasChanges = false;

    snap.forEach((docSnap) => {
      const monthKey = docSnap.id; // YYYY-MM
      const data = docSnap.data().data as string;
      if (!data) return;

      const decoded = decodeAttendance(data);
      for (let d = 0; d < 31; d++) {
        const day = String(d + 1).padStart(2, "0");
        const dateKey = `${monthKey}-${day}`;
        let anyPeriodTrue = false;

        for (let p = 0; p < 8; p++) {
          const periodKey = `${dateKey}_p${p + 1}`;
          if (decoded[d][p]) {
            if (localMap[periodKey] !== true) {
              localMap[periodKey] = true;
              hasChanges = true;
            }
            anyPeriodTrue = true;
          } else {
            if (localMap[periodKey] === true) {
              delete localMap[periodKey];
              hasChanges = true;
            }
          }
        }

        // Update day-level boolean
        if (anyPeriodTrue) {
          if (localMap[dateKey] !== true) {
            localMap[dateKey] = true;
            hasChanges = true;
          }
        } else {
          if (localMap[dateKey] === true) {
            delete localMap[dateKey];
            hasChanges = true;
          }
        }
      }
    });

    if (hasChanges) {
      saveAttendanceMap(localMap);
    }
  } catch (err) {
    console.error("Failed to pull attendance:", err);
  }
}
