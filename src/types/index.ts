export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BusLine {
  cl: number;       // código da linha
  lc: boolean;      // circular
  lt: string;       // letreiro (ex: "8012-10")
  tl: number;       // tipo de letreiro
  sl: number;       // sentido
  tp: string;       // terminal principal
  ts: string;       // terminal secundário
}

export interface BusVehicle {
  p: string;        // prefixo do veículo
  a: boolean;       // acessível
  ta: string;       // horário da última atualização
  py: number;       // latitude
  px: number;       // longitude
}

export interface BusPosition {
  c: string;        // letreiro completo da linha (ex: "847P-10")
  cl: number;       // código da linha
  sl: number;       // sentido: 1 = destino lt0, 2 = destino lt1
  lt0: string;      // letreiro terminal principal
  lt1: string;      // letreiro terminal secundário
  qv: number;       // quantidade de veículos
  vs: BusVehicle[]; // veículos
}

export interface BusStop {
  cp: number;       // código de parada
  np: string;       // nome da parada
  ed: string;       // endereço
  py: number;       // latitude
  px: number;       // longitude
}

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  transitLine?: string;
  departureStop?: string;
  arrivalStop?: string;
  numStops?: number;
  vehicleType?: string;
  lineShortName?: string;
}

export interface Route {
  duration: string;
  distance: string;
  departureTime: string;
  arrivalTime: string;
  steps: RouteStep[];
}

export interface FavoriteRoute {
  id: string;
  name: string;
  origin: { address: string; coords: Coordinates };
  destination: { address: string; coords: Coordinates };
  createdAt: number;
}

export interface FavoriteStop {
  id: string;
  name: string;
  stop: BusStop;
  createdAt: number;
}

// --- Sistema de alertas por horário ---

export interface TimeWindow {
  startHour: number;    // ex: 7
  startMinute: number;  // ex: 25
  endHour: number;      // ex: 8
  endMinute: number;    // ex: 0
}

export interface BusAlert {
  id: string;
  name: string;                      // ex: "Casa → Trabalho manhã"
  route: FavoriteRoute;              // rota a monitorar
  timeWindows: TimeWindow[];         // janelas de horário (pode ter várias)
  maxMinutesAway: number;            // notificar quando ônibus estiver a X min
  activeDays: number[];              // 0=Dom, 1=Seg, ..., 6=Sáb
  enabled: boolean;
  createdAt: number;
}
