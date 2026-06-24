export type TournamentScheduleMatch = {
  match_no: number;
  stage: "32强赛" | "16强赛" | "四分之一决赛" | "半决赛" | "三四名决赛" | "决赛";
  kickoff_date: string;
  kickoff_time_note: string;
  home_slot: string;
  away_slot: string;
  venue: string;
  city: string;
  country: "美国" | "加拿大" | "墨西哥";
  status: "官方占位赛程" | "待真实对阵确认";
  source: "FIFA 官方赛程";
};

const schedule: TournamentScheduleMatch[] = [
  { match_no: 73, stage: "32强赛", kickoff_date: "2026-06-28", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "A组第2", away_slot: "B组第2", venue: "Los Angeles Stadium", city: "洛杉矶", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 74, stage: "32强赛", kickoff_date: "2026-06-29", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "E组第1", away_slot: "A/B/C/D/F组最佳第3", venue: "Boston Stadium", city: "波士顿", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 75, stage: "32强赛", kickoff_date: "2026-06-29", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "F组第1", away_slot: "C组第2", venue: "Monterrey Stadium", city: "蒙特雷", country: "墨西哥", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 76, stage: "32强赛", kickoff_date: "2026-06-29", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "C组第1", away_slot: "F组第2", venue: "Houston Stadium", city: "休斯敦", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 77, stage: "32强赛", kickoff_date: "2026-06-30", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "I组第1", away_slot: "C/D/F/G/H组最佳第3", venue: "New York New Jersey Stadium", city: "纽约/新泽西", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 78, stage: "32强赛", kickoff_date: "2026-06-30", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "E组第2", away_slot: "I组第2", venue: "Dallas Stadium", city: "达拉斯", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 79, stage: "32强赛", kickoff_date: "2026-07-01", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "A组第1", away_slot: "C/E/F/H/I组最佳第3", venue: "Mexico City Stadium", city: "墨西哥城", country: "墨西哥", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 80, stage: "32强赛", kickoff_date: "2026-07-01", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "L组第1", away_slot: "E/H/I/J/K组最佳第3", venue: "Atlanta Stadium", city: "亚特兰大", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 81, stage: "32强赛", kickoff_date: "2026-07-01", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "D组第1", away_slot: "B/E/F/I/J组最佳第3", venue: "San Francisco Bay Area Stadium", city: "旧金山湾区", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 82, stage: "32强赛", kickoff_date: "2026-07-01", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "G组第1", away_slot: "A/E/H/I/J组最佳第3", venue: "Seattle Stadium", city: "西雅图", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 83, stage: "32强赛", kickoff_date: "2026-07-02", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "K组第2", away_slot: "L组第2", venue: "Toronto Stadium", city: "多伦多", country: "加拿大", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 84, stage: "32强赛", kickoff_date: "2026-07-02", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "H组第1", away_slot: "J组第2", venue: "Los Angeles Stadium", city: "洛杉矶", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 85, stage: "32强赛", kickoff_date: "2026-07-02", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "B组第1", away_slot: "E/F/G/I/J组最佳第3", venue: "Vancouver Stadium", city: "温哥华", country: "加拿大", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 86, stage: "32强赛", kickoff_date: "2026-07-03", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "J组第1", away_slot: "H组第2", venue: "Miami Stadium", city: "迈阿密", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 87, stage: "32强赛", kickoff_date: "2026-07-03", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "K组第1", away_slot: "D/E/I/J/L组最佳第3", venue: "Kansas City Stadium", city: "堪萨斯城", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 88, stage: "32强赛", kickoff_date: "2026-07-03", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "D组第2", away_slot: "G组第2", venue: "Dallas Stadium", city: "达拉斯", country: "美国", status: "待真实对阵确认", source: "FIFA 官方赛程" },
  { match_no: 89, stage: "16强赛", kickoff_date: "2026-07-04", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M73胜者", away_slot: "M75胜者", venue: "Philadelphia Stadium", city: "费城", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 90, stage: "16强赛", kickoff_date: "2026-07-04", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M74胜者", away_slot: "M77胜者", venue: "Houston Stadium", city: "休斯敦", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 91, stage: "16强赛", kickoff_date: "2026-07-05", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M76胜者", away_slot: "M78胜者", venue: "New York New Jersey Stadium", city: "纽约/新泽西", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 92, stage: "16强赛", kickoff_date: "2026-07-05", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M79胜者", away_slot: "M80胜者", venue: "Mexico City Stadium", city: "墨西哥城", country: "墨西哥", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 93, stage: "16强赛", kickoff_date: "2026-07-06", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M83胜者", away_slot: "M84胜者", venue: "Dallas Stadium", city: "达拉斯", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 94, stage: "16强赛", kickoff_date: "2026-07-06", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M81胜者", away_slot: "M82胜者", venue: "Seattle Stadium", city: "西雅图", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 95, stage: "16强赛", kickoff_date: "2026-07-07", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M86胜者", away_slot: "M88胜者", venue: "Atlanta Stadium", city: "亚特兰大", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 96, stage: "16强赛", kickoff_date: "2026-07-07", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M85胜者", away_slot: "M87胜者", venue: "Vancouver Stadium", city: "温哥华", country: "加拿大", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 97, stage: "四分之一决赛", kickoff_date: "2026-07-09", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M89胜者", away_slot: "M90胜者", venue: "Boston Stadium", city: "波士顿", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 98, stage: "四分之一决赛", kickoff_date: "2026-07-10", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M93胜者", away_slot: "M94胜者", venue: "Los Angeles Stadium", city: "洛杉矶", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 99, stage: "四分之一决赛", kickoff_date: "2026-07-11", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M91胜者", away_slot: "M92胜者", venue: "Miami Stadium", city: "迈阿密", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 100, stage: "四分之一决赛", kickoff_date: "2026-07-11", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M95胜者", away_slot: "M96胜者", venue: "Kansas City Stadium", city: "堪萨斯城", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 101, stage: "半决赛", kickoff_date: "2026-07-14", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M97胜者", away_slot: "M98胜者", venue: "Dallas Stadium", city: "达拉斯", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 102, stage: "半决赛", kickoff_date: "2026-07-15", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M99胜者", away_slot: "M100胜者", venue: "Atlanta Stadium", city: "亚特兰大", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 103, stage: "三四名决赛", kickoff_date: "2026-07-18", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M101负者", away_slot: "M102负者", venue: "Miami Stadium", city: "迈阿密", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
  { match_no: 104, stage: "决赛", kickoff_date: "2026-07-19", kickoff_time_note: "具体北京时间以 FIFA 最终页面为准", home_slot: "M101胜者", away_slot: "M102胜者", venue: "New York New Jersey Stadium", city: "纽约/新泽西", country: "美国", status: "官方占位赛程", source: "FIFA 官方赛程" },
];

export function getOfficialTournamentSchedule() {
  return schedule;
}
