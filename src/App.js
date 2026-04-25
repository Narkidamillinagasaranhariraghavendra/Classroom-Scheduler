import { useState, useEffect } from "react";

const ROOMS = [
  { id: "R101", name: "Room 101", capacity: 60, type: "Lecture Hall", facilities: ["Projector", "AC", "Mic"] },
  { id: "R202", name: "Room 202", capacity: 40, type: "Seminar Room", facilities: ["Projector", "AC"] },
  { id: "LAB1", name: "CS Lab 1", capacity: 30, type: "Computer Lab", facilities: ["PCs", "AC", "Projector"] },
  { id: "LAB2", name: "CS Lab 2", capacity: 25, type: "Computer Lab", facilities: ["PCs", "AC"] },
  { id: "R303", name: "Room 303", capacity: 80, type: "Lecture Hall", facilities: ["Projector", "AC", "Mic", "Recording"] },
  { id: "R104", name: "Room 104", capacity: 35, type: "Tutorial Room", facilities: ["Whiteboard", "AC"] },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const SLOTS = ["9:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];

const SUBJECTS = ["Data Structures", "DBMS", "OS", "Computer Networks", "Machine Learning", "Web Dev", "Algorithms", "Software Engineering"];
const FACULTY = ["Dr. Sharma", "Prof. Rao", "Dr. Patel", "Prof. Kumar", "Dr. Reddy", "Prof. Singh"];

const initSchedule = () => {
  const schedule = {};
  DAYS.forEach(day => {
    schedule[day] = {};
    SLOTS.forEach(slot => {
      schedule[day][slot] = {};
      ROOMS.forEach(room => {
        if (Math.random() < 0.35) {
          schedule[day][slot][room.id] = {
            subject: SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)],
            faculty: FACULTY[Math.floor(Math.random() * FACULTY.length)],
            students: Math.floor(Math.random() * (room.capacity - 10)) + 10,
          };
        }
      });
    });
  });
  return schedule;
};

const typeColors = {
  "Lecture Hall": { bg: "#E6F1FB", text: "#0C447C", border: "#85B7EB" },
  "Seminar Room": { bg: "#E1F5EE", text: "#085041", border: "#5DCAA5" },
  "Computer Lab": { bg: "#EEEDFE", text: "#3C3489", border: "#AFA9EC" },
  "Tutorial Room": { bg: "#FAEEDA", text: "#633806", border: "#EF9F27" },
};

export default function ClassroomScheduler() {
  const [schedule, setSchedule] = useState(initSchedule);
  const [selectedDay, setSelectedDay] = useState("Mon");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [view, setView] = useState("grid"); // grid | rooms | ai
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [bookingForm, setBookingForm] = useState({ subject: "", faculty: "", students: "" });
  const [showBooking, setShowBooking] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isOccupied = (day, slot, roomId) => !!schedule[day]?.[slot]?.[roomId];

  const getUtilization = (roomId) => {
    let total = 0, used = 0;
    DAYS.forEach(d => SLOTS.forEach(s => {
      total++;
      if (schedule[d]?.[s]?.[roomId]) used++;
    }));
    return Math.round((used / total) * 100);
  };

  const getFreeRooms = (day, slot) =>
    ROOMS.filter(r => !isOccupied(day, slot, r.id));

  const handleCellClick = (slot, room) => {
    setSelectedSlot(slot);
    setSelectedRoom(room);
    if (isOccupied(selectedDay, slot, room.id)) {
      setConflict(schedule[selectedDay][slot][room.id]);
      setShowBooking(false);
    } else {
      setConflict(null);
      setShowBooking(true);
      setBookingForm({ subject: "", faculty: "", students: "" });
    }
  };

  const handleBook = () => {
    if (!bookingForm.subject || !bookingForm.faculty || !bookingForm.students) {
      showToast("Please fill all fields", "error");
      return;
    }
    const s = parseInt(bookingForm.students);
    if (s > selectedRoom.capacity) {
      showToast(`Exceeds capacity (${selectedRoom.capacity})`, "error");
      return;
    }
    setSchedule(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        [selectedSlot]: {
          ...prev[selectedDay][selectedSlot],
          [selectedRoom.id]: { subject: bookingForm.subject, faculty: bookingForm.faculty, students: s },
        },
      },
    }));
    setShowBooking(false);
    showToast(`Booked ${selectedRoom.name} for ${bookingForm.subject}`);
  };

  const handleDelete = () => {
    setSchedule(prev => {
      const updated = { ...prev };
      delete updated[selectedDay][selectedSlot][selectedRoom.id];
      return { ...updated };
    });
    setConflict(null);
    showToast("Booking removed");
  };

  const runAI = async () => {
    setAiLoading(true);
    setAiResult(null);
    const freeRooms = getFreeRooms(selectedDay, selectedSlot || SLOTS[0]);
    const usedRooms = ROOMS.filter(r => !freeRooms.includes(r));
    const utilSummary = ROOMS.map(r => `${r.name} (${r.type}, cap ${r.capacity}): ${getUtilization(r.id)}% utilised`).join(", ");

    const prompt = `You are a smart campus resource allocator AI. Analyze this college room schedule and give suggestions.

Day: ${selectedDay || "Monday"}, Slot: ${selectedSlot || "9:00 AM"}
Available rooms: ${freeRooms.map(r => `${r.name} (${r.type}, capacity ${r.capacity})`).join(", ") || "None"}
Occupied rooms: ${usedRooms.map(r => r.name).join(", ") || "None"}
Overall utilisation: ${utilSummary}

Provide:
1. Which free room is best for a class of 40 students needing a projector and why
2. Two specific suggestions to improve campus room utilisation
3. One scheduling conflict prevention tip

Be concise and practical. Use bullet points. Max 150 words.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "No response.";
      setAiResult(text);
    } catch (e) {
      setAiResult("AI unavailable. Check your connection.");
    }
    setAiLoading(false);
  };

  const totalBookings = Object.values(schedule).flatMap(d => Object.values(d).flatMap(s => Object.values(s))).length;
  const totalSlots = DAYS.length * SLOTS.length * ROOMS.length;
  const overallUtil = Math.round((totalBookings / totalSlots) * 100);

  return (
    <div style={{ fontFamily: "'DM Mono', 'Courier New', monospace", background: "#0D0D0D", minHeight: "100vh", color: "#E8E3D5", padding: "0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #1a1a1a; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        .cell { cursor: pointer; transition: all 0.15s; border-radius: 4px; }
        .cell:hover { transform: scale(1.02); filter: brightness(1.15); }
        .tab-btn { background: transparent; border: none; cursor: pointer; font-family: inherit; font-size: 12px; letter-spacing: 0.08em; padding: 8px 16px; border-radius: 3px; transition: all 0.15s; }
        .tab-btn.active { background: #E8E3D5; color: #0D0D0D; }
        .tab-btn:not(.active) { color: #666; }
        .tab-btn:not(.active):hover { color: #E8E3D5; }
        .day-btn { background: transparent; border: 1px solid #222; font-family: inherit; font-size: 11px; padding: 6px 12px; border-radius: 3px; cursor: pointer; transition: all 0.15s; letter-spacing: 0.06em; }
        .day-btn.active { background: #E8E3D5; color: #0D0D0D; border-color: #E8E3D5; }
        .day-btn:not(.active) { color: #888; }
        .day-btn:not(.active):hover { border-color: #555; color: #E8E3D5; }
        .ai-btn { background: #1a1a2e; border: 1px solid #534AB7; color: #AFA9EC; font-family: inherit; font-size: 12px; padding: 10px 20px; border-radius: 4px; cursor: pointer; transition: all 0.2s; letter-spacing: 0.06em; }
        .ai-btn:hover:not(:disabled) { background: #534AB7; color: #fff; }
        .ai-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .book-btn { background: #E8E3D5; color: #0D0D0D; border: none; font-family: inherit; font-size: 12px; font-weight: 500; padding: 10px 20px; border-radius: 4px; cursor: pointer; transition: all 0.15s; letter-spacing: 0.06em; }
        .book-btn:hover { background: #fff; }
        .del-btn { background: transparent; border: 1px solid #A32D2D; color: #E24B4A; font-family: inherit; font-size: 12px; padding: 8px 16px; border-radius: 4px; cursor: pointer; transition: all 0.15s; }
        .del-btn:hover { background: #A32D2D; color: #fff; }
        input, select { background: #1a1a1a; border: 1px solid #333; color: #E8E3D5; font-family: inherit; font-size: 12px; padding: 8px 10px; border-radius: 4px; width: 100%; outline: none; transition: border-color 0.15s; }
        input:focus, select:focus { border-color: #534AB7; }
        select option { background: #1a1a1a; }
        .bar-fill { transition: width 0.5s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease forwards; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; display: inline-block; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .slide-in { animation: slideIn 0.25s ease forwards; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 999, background: toast.type === "error" ? "#3d1515" : "#0f2d1e", border: `1px solid ${toast.type === "error" ? "#A32D2D" : "#0F6E56"}`, borderRadius: 6, padding: "12px 20px", fontSize: 13, color: toast.type === "error" ? "#E24B4A" : "#1D9E75", fontFamily: "inherit" }} className="slide-in">
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1a1a1a", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "#555", marginBottom: 3 }}>CAMPUSIQ</div>
          <div style={{ fontSize: 18, fontWeight: 500, letterSpacing: "0.02em" }}>Classroom Scheduler</div>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#111", padding: 3, borderRadius: 5 }}>
          {["grid", "rooms", "ai"].map(v => (
            <button key={v} className={`tab-btn ${view === v ? "active" : ""}`} onClick={() => setView(v)}>
              {v === "grid" ? "⊞ Schedule" : v === "rooms" ? "◫ Rooms" : "◈ AI Suggest"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
          <div><span style={{ color: "#555" }}>Utilisation </span><span style={{ color: "#AFA9EC", fontWeight: 500 }}>{overallUtil}%</span></div>
          <div><span style={{ color: "#555" }}>Bookings </span><span style={{ fontWeight: 500 }}>{totalBookings}</span></div>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 69px)" }}>
        {/* Main area */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>

          {/* GRID VIEW */}
          {view === "grid" && (
            <div className="fade-in">
              {/* Day selector */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {DAYS.map(d => (
                  <button key={d} className={`day-btn ${selectedDay === d ? "active" : ""}`} onClick={() => setSelectedDay(d)}>{d}</button>
                ))}
                <div style={{ marginLeft: "auto", fontSize: 11, color: "#444", display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ display: "inline-block", width: 10, height: 10, background: "#1D9E75", borderRadius: 2 }}></span> Free</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ display: "inline-block", width: 10, height: 10, background: "#534AB7", borderRadius: 2 }}></span> Booked</span>
                </div>
              </div>

              {/* Grid */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "separate", borderSpacing: 4, minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th style={{ fontSize: 10, letterSpacing: "0.1em", color: "#444", textAlign: "left", padding: "0 8px 8px", fontWeight: 400 }}>TIME</th>
                      {ROOMS.map(r => (
                        <th key={r.id} style={{ fontSize: 10, letterSpacing: "0.08em", color: "#666", textAlign: "center", padding: "0 4px 8px", fontWeight: 400, minWidth: 90 }}>
                          <div>{r.id}</div>
                          <div style={{ color: "#333", fontSize: 9 }}>{r.type.toUpperCase()}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SLOTS.map(slot => (
                      <tr key={slot}>
                        <td style={{ fontSize: 11, color: "#555", padding: "0 12px 4px 8px", whiteSpace: "nowrap", verticalAlign: "middle" }}>{slot}</td>
                        {ROOMS.map(room => {
                          const booking = schedule[selectedDay]?.[slot]?.[room.id];
                          const isSelected = selectedSlot === slot && selectedRoom?.id === room.id;
                          return (
                            <td key={room.id} style={{ padding: "0 0 4px" }}>
                              <div
                                className="cell"
                                onClick={() => handleCellClick(slot, room)}
                                style={{
                                  height: 56,
                                  background: isSelected ? (booking ? "#2d1a5e" : "#0f2d1e") : booking ? "#1a1030" : "#111",
                                  border: isSelected ? `1px solid ${booking ? "#534AB7" : "#1D9E75"}` : "1px solid #1a1a1a",
                                  padding: 6,
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "center",
                                  borderRadius: 4,
                                }}
                              >
                                {booking ? (
                                  <>
                                    <div style={{ fontSize: 10, color: "#AFA9EC", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.subject}</div>
                                    <div style={{ fontSize: 9, color: "#534AB7", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.faculty}</div>
                                    <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>{booking.students} students</div>
                                  </>
                                ) : (
                                  <div style={{ fontSize: 9, color: "#222", textAlign: "center" }}>+ book</div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ROOMS VIEW */}
          {view === "rooms" && (
            <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {ROOMS.map(room => {
                const util = getUtilization(room.id);
                const colors = typeColors[room.type];
                const freeNow = !isOccupied(selectedDay, SLOTS[0], room.id);
                return (
                  <div key={room.id} style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, padding: 18, cursor: "pointer" }}
                    onClick={() => { setView("grid"); setSelectedRoom(room); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>{room.name}</div>
                        <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{room.type}</div>
                      </div>
                      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 12, background: freeNow ? "#0f2d1e" : "#1a1030", color: freeNow ? "#1D9E75" : "#534AB7", border: `1px solid ${freeNow ? "#0F6E56" : "#3C3489"}` }}>
                        {freeNow ? "FREE NOW" : "OCCUPIED"}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                      {room.facilities.map(f => (
                        <span key={f} style={{ fontSize: 9, letterSpacing: "0.06em", color: "#555", border: "1px solid #222", borderRadius: 3, padding: "2px 6px" }}>{f}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "#444", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
                      <span>Capacity: {room.capacity}</span>
                      <span style={{ color: util > 70 ? "#EF9F27" : util > 40 ? "#1D9E75" : "#555" }}>{util}% utilised</span>
                    </div>
                    <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2 }}>
                      <div className="bar-fill" style={{ height: "100%", width: `${util}%`, background: util > 70 ? "#EF9F27" : "#534AB7", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI VIEW */}
          {view === "ai" && (
            <div className="fade-in" style={{ maxWidth: 600 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>Analysing schedule for:</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {DAYS.map(d => (
                    <button key={d} className={`day-btn ${selectedDay === d ? "active" : ""}`} onClick={() => setSelectedDay(d)}>{d}</button>
                  ))}
                </div>
              </div>
              <div style={{ background: "#0a0a16", border: "1px solid #2a2050", borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#534AB7", marginBottom: 12 }}>AI RESOURCE ADVISOR</div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 16, lineHeight: 1.7 }}>
                  Claude AI will analyze the current schedule and suggest optimizations for room utilisation, conflict prevention, and smart allocation.
                </div>
                <button className="ai-btn" onClick={runAI} disabled={aiLoading}>
                  {aiLoading ? <><span className="spin">◈</span> Analyzing...</> : "◈ Run AI Analysis"}
                </button>
              </div>
              {aiResult && (
                <div className="fade-in" style={{ background: "#111", border: "1px solid #1a3028", borderRadius: 8, padding: 20 }}>
                  <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "#1D9E75", marginBottom: 14 }}>AI RECOMMENDATIONS</div>
                  <div style={{ fontSize: 13, color: "#C2C0B6", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{aiResult}</div>
                </div>
              )}

              {/* Utilisation overview */}
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#444", marginBottom: 12 }}>ROOM UTILISATION OVERVIEW</div>
                {ROOMS.map(r => {
                  const u = getUtilization(r.id);
                  return (
                    <div key={r.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: "#888" }}>{r.name}</span>
                        <span style={{ color: u > 70 ? "#EF9F27" : u > 40 ? "#1D9E75" : "#444" }}>{u}%</span>
                      </div>
                      <div style={{ height: 2, background: "#1a1a1a", borderRadius: 1 }}>
                        <div className="bar-fill" style={{ height: "100%", width: `${u}%`, background: u > 70 ? "#EF9F27" : "#534AB7", borderRadius: 1 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        {(selectedRoom && view === "grid") && (
          <div style={{ width: 260, borderLeft: "1px solid #1a1a1a", padding: 20, overflow: "auto", flexShrink: 0 }} className="slide-in">
            <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "#444", marginBottom: 16 }}>SLOT DETAILS</div>
            <div style={{ background: "#111", borderRadius: 6, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{selectedRoom.name}</div>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>{selectedRoom.type} · Cap {selectedRoom.capacity}</div>
              <div style={{ fontSize: 11, color: "#555" }}>{selectedDay} · {selectedSlot}</div>
            </div>

            {conflict && (
              <div style={{ background: "#1a1030", border: "1px solid #2d1a5e", borderRadius: 6, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#534AB7", marginBottom: 10 }}>CURRENT BOOKING</div>
                <div style={{ fontSize: 12, color: "#AFA9EC", marginBottom: 4 }}>{conflict.subject}</div>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>{conflict.faculty}</div>
                <div style={{ fontSize: 11, color: "#444" }}>{conflict.students} students</div>
                <button className="del-btn" style={{ marginTop: 12, width: "100%" }} onClick={handleDelete}>Remove Booking</button>
              </div>
            )}

            {showBooking && (
              <div className="fade-in">
                <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#1D9E75", marginBottom: 12 }}>NEW BOOKING</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#444", marginBottom: 4 }}>SUBJECT</div>
                    <select value={bookingForm.subject} onChange={e => setBookingForm(f => ({ ...f, subject: e.target.value }))}>
                      <option value="">Select subject</option>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#444", marginBottom: 4 }}>FACULTY</div>
                    <select value={bookingForm.faculty} onChange={e => setBookingForm(f => ({ ...f, faculty: e.target.value }))}>
                      <option value="">Select faculty</option>
                      {FACULTY.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#444", marginBottom: 4 }}>STUDENTS</div>
                    <input type="number" placeholder={`Max ${selectedRoom.capacity}`} value={bookingForm.students} onChange={e => setBookingForm(f => ({ ...f, students: e.target.value }))} />
                  </div>
                  <button className="book-btn" style={{ marginTop: 4 }} onClick={handleBook}>Confirm Booking</button>
                </div>
              </div>
            )}

            {!conflict && !showBooking && (
              <div style={{ fontSize: 11, color: "#333", textAlign: "center", marginTop: 20 }}>Click a cell in the grid to book or view a slot</div>
            )}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #1a1a1a" }}>
              <div style={{ fontSize: 10, letterSpacing: "0.1em", color: "#333", marginBottom: 10 }}>ROOM FACILITIES</div>
              {selectedRoom.facilities.map(f => (
                <div key={f} style={{ fontSize: 11, color: "#555", marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#334", display: "inline-block" }}></span>{f}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}