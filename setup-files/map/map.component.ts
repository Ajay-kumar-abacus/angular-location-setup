import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Renderer2, Inject } from '@angular/core';
import { MatDialog } from '@angular/material';
import { Router, ActivatedRoute } from '@angular/router';
import * as moment from 'moment';
import { DatabaseService } from 'src/_services/DatabaseService';
import { ImageModuleComponent } from 'src/app/image-module/image-module.component';
// import { OlaMaps } from 'olamaps-web-sdk'
import { DOCUMENT } from '@angular/common';
declare var OlaMaps: any;

// Declare Leaflet for map functionality
declare const L: any;
declare var zingchart: any;

interface EmployeeData {
  name: string;
  employee_id: string;
  contact_01: any;
}

interface LocationData {
  lat: number;
  lng: number;
  type: string;
  address: string;
  timestamp: string;
  distance_from_last?: string;
  total_distance_from_start?: string;
  date_created: string;
  dr_name?: string;
  dr_type_name?: string;
  visit_end?: string;
  sequence?: number;
  id?: string;
}

interface LatestLocation {
  lat: number;
  lng: number;
  gps: string;
  time: string;
  total_checkin: number;
}

interface TrackingAccuracy {
  background: number;
  virtual: number;
}

interface PlaybackControl {
  speed: number;
  progress: number;
  status: string;
  start: () => void;
  pause: () => void;
}

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('trackingMap') mapElement: ElementRef;
  userList: any[] = [];
  selectedUserId: string = '';
  isLoadingUsers: boolean = false;
  showCheckinAlert: boolean = false;
  activeTab: string = 'live';
  isLoading: boolean = false;
  isMapLoading: boolean = false;
  private chartId = 'analyticsChart';
  permissionsData: any = {};
permissionsList: any[] = [];
groupedPermissions: any = {};
selectedHour: string = '';
hourlyStats: any = {};

  showTimelineMap: boolean = false;
  timelineMapView: any;
  private chart: any;
  private _isSidebarVisible: boolean = false;

  get isSidebarVisible(): boolean {
    return this._isSidebarVisible;
  }

  set isSidebarVisible(value: boolean) {
    if (this._isSidebarVisible !== value) {
      this._isSidebarVisible = value;
      this.toggleFullScreen(value);
      this.onFullscreenToggle();
    }
  }


  // Live Users Tracking Properties
  liveUsersData: any[] = [];
  liveUsersMarkers: any[] = [];
  liveUsersUpdateInterval: any;
  showUsersList: boolean = true;
  selectedLiveUsers: Set<string> = new Set();

  timelineEvents: any[] = [];
  timelineData: any = {};

  // Add these at the top of your class with other properties
  private liveTrackingInterval: any;
  private currentLiveMarker: any;
  private previousPosition: [number, number] | null = null;
  private isAnimating: boolean = false;

  // TrackPlayer properties
  private trackPlayer: any;
  private trackPlayerInterval: any;
  private trackPlayerPoints: any[] = [];

  employeeData: EmployeeData = {
    name: '',
    employee_id: '',
    contact_01: ''
  };

  locationData: LocationData[] = [];
  latestLocation: LatestLocation = {
    lat: 0,
    lng: 0,
    gps: '',
    time: '',
    total_checkin: 0
  };

  attendanceSummary: LocationData[] = [];
  checkinData: LocationData[] = [];

  trackingAccuracy: TrackingAccuracy = {
    background: 0,
    virtual: 0
  };

  map: any;
  locationMarkers: LocationData[] = [];
  roadRoute: any; // This will hold the road-based route
  routingControl: any;
  trackingInterval: any;

  selectedDate: string = moment().format('YYYY-MM-DD');
  maxDate: string = moment().format('YYYY-MM-DD');
  totalDistance: string = '0';
  locationDistance: string = '0';

  playbackControl: PlaybackControl;
  playbackStatus: string = 'stopped';
  playbackProgress: number = 0;
  playbackSpeed: number = 1000;
  showSpeedControl: boolean = false;
  playbackMarker: any;
  playbackInterval: any;
  roadRouteCoordinates: [number, number][] = []; // Store road route coordinates
  currentPlaybackIndex: number = 0; // Track current position in route

  batteryData: number[] = [];
  batteryTimeLabels: string[] = [];
  batteryChart: any;

  payload: any = {};
  userId: string = '';
  playbackDateTime: any;
  total_distance: any;
  debugFlag: any = false;
  summarizeData: any ={};
  snapToRoad: boolean = false;
  end_point: any;
  start_point: any;
  activeTime: any;
  missingPermissionsCount: number = 0;
  missingPermissions: string[] = [];
  oldFlag: any = false;
  userLocationsData: any;
  timeline_gaps: any;
  checkin: any; 
  attendanceData: any;
  url: any;
  userListing: boolean = false;
  checkinKM: any;
  timelineCheckin: any;
  summaryTimelineCheckin: any;
  dateTimeKM: any; // Add this property for TrackPlayer
  liveTrackPlayer: any;
  downurl: any = '';
  timelineInsights: any;
  // Sales & Performance KPIs
  TC: any;
  PC: any;
  secondary_sale_amount: any;
  New_Counter: any;
  New_counter_TC: any;
  New_counter_PC: any;
  counter_primary_Value: any;
  counter_secondary_Value: any;
  showMoreKpis: boolean = false;
  baseLat: any;
  baseLng: any;
  attendanceVariation: any;
  showPermissionsDisclaimer: boolean=false;
  
// showGpsTooltip: boolean = false;
  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    public service: DatabaseService,
    public dialogs: MatDialog,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {
     this.downurl = service.uploadUrl;
    this.initializePlaybackControl();
    this.url = this.service.uploadUrl;
  }

  ngAfterViewInit(): void {
    // this.renderChart();
  }

  ngOnInit(): void {
    this.loadRouteParams();

    this.activeTab = 'liveusers';

    if (this.selectedUserId || this.payload.user_id) {
      this.initializeData();
    }

    this.loadUsersList();
    this.switchTab('liveusers');
  }

  ngOnDestroy(): void {
    if (this.trackPlayer) {
      this.trackPlayer.pause();
      this.trackPlayer.remove();
      this.trackPlayer = null;
    }
    if (this.liveTrackPlayer) {
      this.liveTrackPlayer.pause();
      this.liveTrackPlayer.remove();
      this.liveTrackPlayer = null;
    }
    if (this.map) {
      this.map.remove();
    }
    if (this.liveUsersMap) {
      this.liveUsersMap.remove();
    }
    this.clearIntervals();
  }

  showCheckinTimeline(): void {
    if (this.timelineCheckin && this.timelineCheckin.length > 0) {
      this.showCheckinAlert = true;
    }
  }

  // Add method to close the alert
  closeCheckinAlert(): void {
    this.showCheckinAlert = false;
  }

  isToday(): boolean {
    return moment(this.selectedDate).isSame(moment(), 'day');
  }

  private renderChart(): void {
    console.log("line 141");

    // Use the component's chartId property
    const chartContainer = document.getElementById(this.chartId);
    if (!chartContainer) {
      console.error('Chart container not found. Element ID:', this.chartId);
      return;
    }

    const myConfig = {
      type: "line",
      utc: true,
      plotarea: {
        margin: "dynamic 45 60 dynamic",
      },
      legend: {
        layout: "float",
        backgroundColor: "none",
        borderWidth: 0,
        shadow: 0,
        align: "center",
        adjustLayout: true,
        toggleAction: "none", // <-- disables remove/hide toggle
        item: {
          padding: 7,
          marginRight: 17,
          cursor: "default" // no pointer effect
        }
      },
      scaleX: {
        minValue: new Date().setHours(8, 0, 0, 0), // start 8:00 AM
        maxValue: new Date().setHours(23, 30, 0, 0), // end 11:30 PM
        step: 3600000,
        transform: {
          type: "date",
          all: "%h:%i %A",
        },
        label: { visible: false },
        minorTicks: 0
      },
      scaleY: {
        minValue: 0,
        maxValue: 100,
        step: 10,
        lineColor: "#f6f7f8",
        shadow: 0,
        guide: {
          lineStyle: "dashed"
        },
        label: {
          text: "Battery %"
        },
        minorTicks: 0
      },
      crosshairX: {
        lineColor: "#efefef",
        plotLabel: {
          borderRadius: "5px",
          borderWidth: "1px",
          borderColor: "#f6f7f8",
          padding: "10px",
          fontWeight: "bold"
        },
        scaleLabel: {
          fontColor: "#000",
          backgroundColor: "#f6f7f8",
          borderRadius: "5px"
        }
      },
      tooltip: {
        visible: true,
        text: "%v%" // <-- only value with percentage
      },
      plot: {
        highlight: true,
        tooltipText: "%v%",
        shadow: 0,
        lineWidth: "2px",
        marker: {
          type: "circle",
          size: 3
        },
        highlightState: {
          lineWidth: 3
        },
        animation: {
          effect: 1,
          sequence: 2,
          speed: 100,
        }
      },
      series: [{
        values: [85, 82, 78, 75, 72, 69, 65, 60, 55], // battery % values
        lineColor: "#007790",
        marker: {
          backgroundColor: "#007790",
          borderWidth: 1,
          borderColor: "#69dbf1"
        },
        highlightMarker: {
          size: 6,
          backgroundColor: "#007790"
        },
        text: "" // <-- no legend text
      }]
    };

    try {
      // Destroy existing chart if it exists
      if (this.chart) {
        zingchart.exec(this.chartId, 'destroy');
      }

      // Render the chart
      this.chart = zingchart.render({
        id: this.chartId,
        data: myConfig,
        height: '400px', // Set explicit height instead of '100%'
        width: '100%'
      });

      console.log("Chart rendered successfully");
    } catch (error) {
      console.error("Error rendering chart:", error);
    }
  }

  private loadRouteParams(): void {
    this.activatedRoute.queryParams.subscribe(params => {
      console.log('Route params:', params)
      if (params) {
        this.payload = params;
        this.userId = params.user_id || '';
        this.selectedUserId = params.user_id || '';
        this.selectedDate = params.start_date || moment().format('YYYY-MM-DD');
      }
    });
  }

  private initializeData(): void {
    this.isLoading = true;
    setTimeout(() => {
      // this.loadEmployeeData();
      this.loadLocationData();
      this.UserInformation();
      this.UserInformationDetail();
      this.loadTrackingAccuracy();
      this.loadLocationTimeLine();
      this.loadGetDayActivityTimeline()
       this.loadGetPermissionReport()
    }, 1000);
  }

  private calculateTotalDistance(): void {
    let distance = 0;
    for (let i = 1; i < this.locationData.length; i++) {
      distance += parseFloat(this.locationData[i].distance_from_last || '0');
    }
    this.totalDistance = distance.toFixed(1);
    this.locationDistance = this.totalDistance;
  }

 

  private loadTrackingAccuracy(): void {
    this.trackingAccuracy = {
      background: 85,
      virtual: 92
    };
  }

  private loadAttendanceSummary(): void {
    this.attendanceSummary = this.locationData.filter(loc =>
      loc.type === 'Attendence Start' || loc.type === 'Checkin'
    );
  }

  switchTab(tab: string): void {
    // Clear live tracking interval when switching away from live
    if (this.activeTab === 'live' && tab !== 'live') {
      if (this.liveTrackingInterval) {
        clearInterval(this.liveTrackingInterval);
        this.liveTrackingInterval = null;
      }
    }

    this.activeTab = tab;
    switch (tab) {
      case 'live':
        if (this.isToday()) {
          this.initializeLiveMap();
        }
        break;
      case 'route':
        this.initializeRouteMap();
        break;
      case 'playback':
        this.initializePlaybackMap();
        break;
      case 'health':
        break;
      case 'liveusers':
        this.initializeLiveUsersMap();
        break;
      case 'timeline':
        this.loadLocationTimeLine();
        setTimeout(() => {
          this.initializeTimelineMapView();
        }, 500);
        break;
         case 'permissions':
      this.loadGetPermissionReport();
      break;
    }
  }

  private async initializeRouteMap(): Promise<void> {
    console.log("Initializing route map")

    setTimeout(async () => {
      if (this.map) {
        this.destroyExistingMap();
      }

      // Create map
      this.map = L.map('trackingMap').setView([this.latestLocation.lat, this.latestLocation.lng], 12);

      // Add tile layer
      L.tileLayer('http://{s}.google.com/vt?lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(this.map);

      // Get road route and draw it
      await this.drawRoadRoute();

      // Add markers for all locations
      // if (this.debugFlag == true) {
      this.addLocationMarkers();
      // }

      // Fit map to show the route
      this.fitMapToBounds();

      this.isMapLoading = false;
    }, 500);
  }

  private async initializeLiveMap(): Promise<void> {
    console.log("line 425")
    if (!this.isToday()) {
      this.switchTab('route');
      return;
    }
    setTimeout(async () => {
      if (this.map) {
        this.destroyExistingMap();
      }

      // Create map
      this.map = L.map('trackingMap').setView([this.latestLocation.lat, this.latestLocation.lng], 12);

      // Add tile layer
      L.tileLayer('http://{s}.google.com/vt?lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(this.map);

      // Get road route and draw it
      await this.drawRoadRoute();

      // Add markers for all locations
      // if (this.debugFlag == true) {
      this.addLocationMarkers();
      // }

      // Create live tracking marker
      if (this.locationMarkers.length > 0) {
        const lastPoint = this.locationMarkers[this.locationMarkers.length - 1];


        this.previousPosition = [lastPoint.lat, lastPoint.lng];
      }

      // Start live tracking interval
      if (this.liveTrackingInterval) {
        clearInterval(this.liveTrackingInterval);
      }

      this.liveTrackingInterval = setInterval(() => {
        this.fetchAndUpdateLiveLocation();
      }, 10000); // Update every 10 seconds

      // Fit map to show the route
      this.fitMapToBounds();

      this.isMapLoading = false;
    }, 500);
  }

  private fetchAndUpdateLiveLocation(): void {
    const userIdToUse = this.selectedUserId || this.payload.user_id;

    let header = {
      'date': this.selectedDate,
      'user_id': userIdToUse
    };

    this.service.post_rqst(header, "BackgroundLocationProcess/getDailyReportCalculated")
      .subscribe((result => {
        if (result.route.points.length > 0) {
          const newLocationMarkers = result.route.points;
          const latestPoint = newLocationMarkers[newLocationMarkers.length - 1];
          const newPosition: [number, number] = [latestPoint.lat, latestPoint.lng];

          // Check if position has changed
          if (this.previousPosition &&
            (this.previousPosition[0] !== newPosition[0] ||
              this.previousPosition[1] !== newPosition[1])) {

            // Animate marker to new position
            this.animateMarkerMovement(newPosition);

            // Update route if there are new points
            if (newLocationMarkers.length > this.locationMarkers.length) {
              this.locationMarkers = newLocationMarkers;
              this.updateLiveRoute();
            }
          }

          // Update total distance if changed
          if (result.route.distance_km) {
            this.total_distance = result.route.distance_km;
          }
        }
      }));
  }

  private animateMarkerMovement(newPosition: [number, number]): void {
    if (!this.currentLiveMarker || !this.previousPosition || this.isAnimating) {
      return;
    }

    this.isAnimating = true;
    const startPosition = this.previousPosition;
    const duration = 9000; // 9 seconds (leaving 1 second buffer before next update)
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out interpolation
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const lat = startPosition[0] + (newPosition[0] - startPosition[0]) * easeProgress;
      const lng = startPosition[1] + (newPosition[1] - startPosition[1]) * easeProgress;

      this.currentLiveMarker.setLatLng([lat, lng]);

      // Pan map to follow marker (optional)
      if (progress === 1) {
        this.map.panTo([lat, lng], { animate: true, duration: 0.5 });
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.previousPosition = newPosition;
        this.isAnimating = false;
      }
    };

    requestAnimationFrame(animate);
  }

  private updateLiveRoute(): void {
    if (!this.roadRoute || !this.map) return;

    // Generate new interpolated route
    const waypoints: [number, number][] = this.locationMarkers.map(
      (marker): [number, number] => [marker.lat, marker.lng]
    );

    const newRouteCoordinates = this.interpolateRoute(waypoints);

    // Update the existing route
    this.roadRoute.setLatLngs(newRouteCoordinates);
    this.roadRouteCoordinates = newRouteCoordinates;

    // Update end marker position - FIXED VERSION
    const lastIndex = this.locationMarkers.length - 1;
    const endMarkerIcon = L.icon({
      iconUrl: 'assets/img/person1.png',
      iconSize: [45, 45],
      iconAnchor: [22, 22],
      popupAnchor: [0, -20]
    });

    // Safer way to remove old end marker
    this.map.eachLayer((layer: any) => {
      // Check if layer exists and has the necessary properties
      if (layer &&
        layer.options &&
        layer.options.icon &&
        layer.options.icon.options &&
        layer.options.icon.options.iconUrl === 'assets/img/person1.png') {
        this.map.removeLayer(layer);
      }
    });

    // Add new end marker
    L.marker([this.locationMarkers[lastIndex].lat, this.locationMarkers[lastIndex].lng], {
      icon: endMarkerIcon
    }).addTo(this.map);
  }

  // UPDATED PLAYBACK MAP WITH TRACKPLAYER
  private async initializePlaybackMap(): Promise<void> {
    if (!this.locationMarkers.length) return;

    this.isMapLoading = true;
    setTimeout(async () => {
      this.destroyExistingMap();

      // Create map
      this.map = L.map('trackingMap').setView([this.locationMarkers[0].lat, this.locationMarkers[0].lng], 12);

      // Add tile layer
      L.tileLayer('http://{s}.google.com/vt?lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(this.map);

     

      // Add location markers
      this.addLocationMarkers();

      // Initialize TrackPlayer
      this.initializeTrackPlayer();

      // Fit map to show all points
      this.fitMapToBounds();

      this.isMapLoading = false;
    }, 500);
  }

  // NEW TRACKPLAYER METHODS
  private initializeTrackPlayer(): void {
    // Prepare track points with datetime and distance info
    this.trackPlayerPoints = this.locationMarkers.map((marker, index) => ({
      lat: marker.lat,
      lng: marker.lng,
      dateTime: moment(marker.timestamp || marker.date_created).format('DD MMM YYYY, hh:mm a') + 
                ` (${marker.total_distance_from_start || '0'} KM)`
    }));

    // Remove existing track player if it exists
    if (this.trackPlayer) {
      this.trackPlayer.remove();
    }

    // Create TrackPlayer instance
    this.trackPlayer = new L.TrackPlayer(this.trackPlayerPoints, {
      markerIcon: L.icon({
        iconUrl: 'assets/img/person.png',
        iconSize: [45, 45],
        iconAnchor: [22, 22],
        popupAnchor: [0, -20]
      }),
      speed: 1000, // Default speed in ms
      markerRotation: true, // Enable rotation based on direction
      panTo: true // Pan map to follow marker
    }).addTo(this.map);

    // Initialize playback control
    this.playbackControl = {
      speed: this.trackPlayer.options.speed,
      progress: 0,
      status: 'stopped',
      start: () => this.startPlayback(),
      pause: () => this.pausePlayback()
    };

    // Set up TrackPlayer event listeners
    this.setupTrackPlayerEvents();
  }

  private setupTrackPlayerEvents(): void {
    // Track player started
    this.trackPlayer.on('start', () => {
      this.playbackStatus = 'playing';
      this.startProgressInterval();
    });

    // Track player paused
    this.trackPlayer.on('pause', () => {
      this.playbackStatus = 'paused';
      this.stopProgressInterval();
    });

    // Track player finished
    this.trackPlayer.on('finished', () => {
      this.playbackStatus = 'stopped';
      this.playbackProgress = 100;
      this.stopProgressInterval();
    });

    // Track player progress update
    this.trackPlayer.on('progress', (progress, location, index) => {
      this.playbackProgress = progress * 100;
      
      // Update datetime display based on progress
      if (index < this.locationMarkers.length) {
       const ts = this.locationMarkers[index].timestamp || this.locationMarkers[index].date_created;
    this.playbackDateTime = this.convertToIST(ts);

      }
      
      // Update any additional UI elements if needed
      this.dateTimeKM = location.dateTime;
    });
  }

private convertToIST(timestamp: string | number): string {
  const ts = Number(timestamp);           // ✅ ensure it's a number
  if (isNaN(ts)) return '';               // optional: handle invalid input
  return moment.unix(ts).utcOffset("+05:30").format("YYYY-MM-DD HH:mm:ss");
}


  // Replace existing startPlayback method
  startPlayback(): void {
    if (!this.trackPlayer) {
      console.warn('TrackPlayer not initialized');
      return;
    }

    // Start from current progress position
    if (this.playbackProgress > 0 && this.playbackProgress < 100) {
      this.trackPlayer.setProgress(this.playbackProgress / 100);
    }

    this.trackPlayer.start();
    this.playbackStatus = 'playing';
  }

  // Replace existing pausePlayback method
  pausePlayback(): void {
    if (!this.trackPlayer) return;
    
    this.trackPlayer.pause();
    this.playbackStatus = 'paused';
  }

  // Replace existing updateProgress method
  updateProgress(event: any): void {
    this.playbackProgress = parseFloat(event.target.value);
    
    if (this.trackPlayer) {
      this.trackPlayer.setProgress(this.playbackProgress / 100);
      
      // Update datetime based on progress
      const markerIndex = Math.floor((this.playbackProgress / 100) * (this.locationMarkers.length - 1));
      if (markerIndex < this.locationMarkers.length) {
        // this.playbackDateTime = moment(this.locationMarkers[markerIndex].timestamp || this.locationMarkers[markerIndex].date_created);

         const ts = this.locationMarkers[markerIndex].timestamp || this.locationMarkers[markerIndex].date_created;
    this.playbackDateTime = this.convertToIST(ts);
      }
    }
  }

  // Helper methods for progress interval
  private startProgressInterval(): void {
    this.stopProgressInterval(); // Clear any existing interval
    
    this.trackPlayerInterval = setInterval(() => {
      // Progress is automatically updated by TrackPlayer events
      // This interval can be used for any additional UI updates if needed
    }, 100);
  }

  private stopProgressInterval(): void {
    if (this.trackPlayerInterval) {
      clearInterval(this.trackPlayerInterval);
      this.trackPlayerInterval = null;
    }
  }

  // Add formatLabel method for speed control
  formatLabel(value: number): string {
    if (this.trackPlayer) {
      this.trackPlayer.setSpeed(value);
    }
    return `${value}`;
  }

 

  // Add these properties to your MapComponent class
  private routeArrows: any[] = [];

  // Enhanced drawRoadRoute method
  private async drawRoadRoute(): Promise<void> {
    // Remove existing route if it exists
    if (this.roadRoute) {
      this.map.removeLayer(this.roadRoute);
    }

    // Remove existing arrows if they exist
    if (this.routeArrows && this.routeArrows.length > 0) {
      this.routeArrows.forEach(arrow => this.map.removeLayer(arrow));
      this.routeArrows = [];
    }
    console.log(this.locationMarkers,"line 881")

    if (this.locationMarkers.length > 1) {
      const waypoints: [number, number][] = this.locationMarkers.map(
        (marker): [number, number] => [marker.lat, marker.lng]
      );

      // Create interpolated points for smoother route
      this.roadRouteCoordinates = waypoints;

      // Create enhanced polyline with better styling
      this.roadRoute = L.polyline(this.roadRouteCoordinates, {
        color: '#013c6dff',
        weight: 3,
        opacity: 0.9,
        smoothFactor: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);

      // Add direction arrows
      this.addDirectionArrows();

      this.addStartPointLocationMarker();

      this.addEndPointLocationMarker();
      this.addHomeLocation()

      console.log('Enhanced route created with', this.roadRouteCoordinates.length, 'points');
    }
  }

  // Interpolate points between waypoints for smoother route
  private interpolateRoute(waypoints: [number, number][]): [number, number][] {
    const interpolatedPoints: [number, number][] = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];

      // Add the start point
      interpolatedPoints.push(start);

      // Calculate distance between points
      const distance = this.calculateDistance(start, end);

      // Add interpolated points based on distance (more points for longer segments)
      const numInterpolatedPoints = Math.max(2, Math.floor(distance * 10)); // 10 points per km

      for (let j = 1; j < numInterpolatedPoints; j++) {
        const ratio = j / numInterpolatedPoints;
        const lat = start[0] + (end[0] - start[0]) * ratio;
        const lng = start[1] + (end[1] - start[1]) * ratio;
        interpolatedPoints.push([lat, lng]);
      }
    }

    // Add the final point
    interpolatedPoints.push(waypoints[waypoints.length - 1]);

    return interpolatedPoints;
  }

  // Add direction arrows along the route
  private addDirectionArrows(): void {
    if (!this.routeArrows) {
      this.routeArrows = [];
    }

    const arrowSpacing = Math.max(5, Math.floor(this.roadRouteCoordinates.length / 15)); // Dynamic spacing
    const arrowSize = 15;

    for (let i = 0; i < this.roadRouteCoordinates.length - arrowSpacing; i += arrowSpacing) {
      const startPoint = this.roadRouteCoordinates[i];
      const endPoint = this.roadRouteCoordinates[Math.min(i + arrowSpacing, this.roadRouteCoordinates.length - 1)];

      // Calculate bearing/angle for arrow direction
      const bearing = this.calculateRouteBearing(startPoint[0], startPoint[1], endPoint[0], endPoint[1]);

      // Create arrow marker
      const arrowIcon = L.divIcon({
        html: this.createArrowSVG(bearing),
        className: 'route-arrow',
        iconSize: [arrowSize, arrowSize],
        iconAnchor: [arrowSize / 2, arrowSize / 2]
      });

      const arrowMarker = L.marker([startPoint[0], startPoint[1]], {
        icon: arrowIcon,
        interactive: false
      }).addTo(this.map);

      this.routeArrows.push(arrowMarker);
    }
  }

  // Create SVG arrow pointing in the specified direction
  private createArrowSVG(bearing: number): string {
    return `
    <div style="transform: rotate(${bearing}deg); display: flex; align-items: center; justify-content: center;">
      <svg width="20" height="20" viewBox="0 0 24 24" style="filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.3));">
        <path d="M12 2 L20 10 L16 10 L16 22 L8 22 L8 10 L4 10 Z" 
              fill="#c40000ff" 
              stroke="red" 
              stroke-width="0.5"
              opacity="0.9"/>
      </svg>
    </div>
  `;
  }

  // Calculate bearing between two points (renamed to avoid conflict)
  private calculateRouteBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360; // Normalize to 0-360

    return bearing;
  }

  

  // Enhanced version of your existing calculateDistance method
  private calculateDistance(point1: [number, number], point2: [number, number]): number {
    const R = 6371; // Earth's radius in km
    const dLat = (point2[0] - point1[0]) * Math.PI / 180;
    const dLon = (point2[1] - point1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

private addLocationMarkers(): void {
  if (!this.checkin || this.checkin.length === 0) return;

  this.checkin.forEach((location, index) => {
    const markerColor = this.getMarkerColor(location.dr_type_name);

    const icon = L.divIcon({
      html: `<div style="background-color: ${markerColor}; color: #fff; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.4);">${index + 1}</div>`,
      className: 'custom-numbered-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });

    // Find matching timeline data for this checkin
    const timelineData = this.findTimelineDataForCheckin(location);

    L.marker([location.start_lat, location.start_lng], { icon })
      .addTo(this.map)
      .bindPopup(this.createMarkerPopup(location, timelineData));
  });
}

private findTimelineDataForCheckin(checkin: any): any {
  if (!this.timelineCheckin || this.timelineCheckin.length === 0) return null;
  
  // Find timeline entry that matches this checkin by datetime or id
  return this.timelineCheckin.find(timeline => 
    timeline.type === 'checkin' && 
    (timeline.datetime === checkin.visit_start || 
     (timeline.details && timeline.details.checkin_id === checkin.id))
  );
}
  private addStartPointLocationMarker(): void {
    console.log("line 678")
    const icon = L.icon({
      iconUrl: 'assets/img/map-pin.png', // replace with your image path
      iconSize: [45, 45], // size of the icon
      iconAnchor: [22, 22], // point of the icon which will correspond to marker's location
      popupAnchor: [0, -20] // adjust popup position
    });

    L.marker([this.locationMarkers[0].lat, this.locationMarkers[0].lng], { icon })
      .addTo(this.map);
  }
   private addHomeLocation(): void {
    console.log("line 678")
    const icon = L.icon({
      iconUrl: 'assets/img/home-address.png', // replace with your image path
      iconSize: [45, 45], // size of the icon
      iconAnchor: [22, 22], // point of the icon which will correspond to marker's location
      popupAnchor: [0, -20] // adjust popup position
    });

    L.marker([this.baseLat, this.baseLng], { icon })
      .addTo(this.map);
  }

  private addEndPointLocationMarker(): void {
    const lastIndex = this.locationMarkers.length - 1;
    console.log("line 678")
    const icon = L.icon({
      iconUrl: 'assets/img/person1.png', // replace with your image path
      iconSize: [45, 45], // size of the icon
      iconAnchor: [22, 22], // point of the icon which will correspond to marker's location
      popupAnchor: [0, -20] // adjust popup position
    });

    L.marker([this.locationMarkers[lastIndex].lat, this.locationMarkers[lastIndex].lng], { icon })
      .addTo(this.map);
  }

private getMarkerColor(type: string): string {
  const colorMap = {
    'Retailer': '#4CAF50',
    'Enquiry': '#2196F3',
    'Stockist': '#FF9800',
    'Distributor': '#9C27B0',
    'Dealer': '#00BCD4',
    'Contractor': '#FF5722',
    'Doctor': '#E91E63'
  };
  return colorMap[type] || '#757575';
}

private createMarkerPopup(checkin: any, timelineData: any = null): string {
  return `
    <div style="min-width: 300px; max-width: 400px; font-family: Arial, sans-serif;">
      <!-- Header Section -->
      <div style="background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 12px; border-radius: 8px 8px 0 0;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <i class="material-icons" style="font-size: 24px;">where_to_vote</i>
          <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${checkin.dr_name || 'Check-in Location'}</h3>
        </div>
        <div style="font-size: 12px; opacity: 0.9;">
          <i class="material-icons" style="font-size: 14px; vertical-align: middle;">badge</i>
          ID: ${checkin.id}
        </div>
      </div>

      <!-- Main Content -->
      <div style="display: grid; gap: 10px;">
        
        <!-- Contact & Type Info -->
        <div style="background: #f5f5f5; padding: 10px; border-radius: 6px;">
          ${checkin.mobile ? `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <i class="material-icons" style="font-size: 18px; color: #4CAF50;">phone</i>
              <span style="font-size: 14px;"><strong>Mobile:</strong> ${checkin.mobile}</span>
            </div>
          ` : ''}
          ${checkin.dr_type_name ? `
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="material-icons" style="font-size: 18px; color: #FF9800;">category</i>
              <span style="font-size: 14px;"><strong>Type:</strong> ${checkin.dr_type_name}</span>
            </div>
          ` : ''}
        </div>

        <!-- Visit Timing with Distance from Timeline -->
        <div style="background: #e8f5e9; padding: 10px; border-radius: 6px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <i class="material-icons" style="font-size: 18px; color: #4CAF50;">login</i>
            <span style="font-size: 14px;"><strong>Check-in:</strong> ${moment(checkin.visit_start).format('DD MMM YYYY, hh:mm A')}</span>
          </div>
          ${checkin.visit_end ? `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <i class="material-icons" style="font-size: 18px; color: #f44336;">logout</i>
              <span style="font-size: 14px;"><strong>Check-out:</strong> ${moment(checkin.visit_end).format('DD MMM YYYY, hh:mm A')}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; background: #fff; padding: 6px; border-radius: 4px; margin-bottom: 6px;">
              <i class="material-icons" style="font-size: 18px; color: #2196F3;">schedule</i>
              <span style="font-size: 14px;"><strong>Duration:</strong> ${this.calculateDuration(checkin.visit_start, checkin.visit_end)}</span>
            </div>
          ` : `
            <div style="background: #fff3e0; padding: 6px; border-radius: 4px; font-size: 13px; color: #f57c00; margin-bottom: 6px;">
              <i class="material-icons" style="font-size: 16px; vertical-align: middle;">info</i>
              Still checked in
            </div>
          `}
          
          ${timelineData && timelineData.distance_from_previous ? `
            <div style="border-top: 1px solid #c8e6c9; padding-top: 8px; margin-top: 4px;">
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #2e7d32;">
                <i class="material-icons" style="font-size: 16px; vertical-align: middle;">directions</i>
                Travel Information:
              </div>
              <div style="display: flex; align-items: center; gap: 8px; background: #fff; padding: 6px; border-radius: 4px; margin-bottom: 4px;">
                <i class="material-icons" style="font-size: 16px; color: #4CAF50;">directions_car</i>
                <span style="font-size: 13px;"><strong>Distance:</strong> ${timelineData.distance_from_previous.formatted}</span>
              </div>
              ${timelineData.distance_from_previous.duration_formatted ? `
                <div style="display: flex; align-items: center; gap: 8px; background: #fff; padding: 6px; border-radius: 4px; margin-bottom: 4px;">
                  <i class="material-icons" style="font-size: 16px; color: #4CAF50;">schedule</i>
                  <span style="font-size: 13px;"><strong>Travel Time:</strong> ${timelineData.distance_from_previous.duration_formatted}</span>
                </div>
              ` : ''}
              ${timelineData.distance_from_previous.speed_kmh ? `
                <div style="display: flex; align-items: center; gap: 8px; background: #fff; padding: 6px; border-radius: 4px; margin-bottom: 4px;">
                  <i class="material-icons" style="font-size: 16px; color: #4CAF50;">speed</i>
                  <span style="font-size: 13px;"><strong>Avg Speed:</strong> ${timelineData.distance_from_previous.speed_kmh.toFixed(1)} km/h</span>
                </div>
              ` : ''}
              ${timelineData.distance_from_previous.segment ? `
                <div style="display: flex; align-items: center; gap: 8px; background: #fff; padding: 6px; border-radius: 4px;">
                  <i class="material-icons" style="font-size: 16px; color: #4CAF50;">route</i>
                  <span style="font-size: 13px;"><strong>Segment:</strong> ${timelineData.distance_from_previous.segment}</span>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Address -->
        ${checkin.start_address ? `
          <div style="background: #fff3e0; padding: 10px; border-radius: 6px;">
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <i class="material-icons" style="font-size: 18px; color: #FF9800; margin-top: 2px;">location_on</i>
              <span style="font-size: 13px; line-height: 1.5; flex: 1;">${checkin.start_address}</span>
            </div>
          </div>
        ` : ''}

        <!-- Activities -->
        ${(checkin.order_flag || checkin.followup_flag || checkin.doc_flag || checkin.popgift_flag) ? `
          <div style="background: #f3e5f5; padding: 10px; border-radius: 6px;">
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #7B1FA2;">
              <i class="material-icons" style="font-size: 16px; vertical-align: middle;">assignment</i>
              Activities:
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${checkin.order_flag ? '<span style="background: #4CAF50; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px;"><i class="material-icons" style="font-size: 12px; vertical-align: middle;">shopping_cart</i> Order</span>' : ''}
              ${checkin.followup_flag ? '<span style="background: #2196F3; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px;"><i class="material-icons" style="font-size: 12px; vertical-align: middle;">phone_in_talk</i> Follow-up</span>' : ''}
              ${checkin.doc_flag ? '<span style="background: #FF9800; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px;"><i class="material-icons" style="font-size: 12px; vertical-align: middle;">description</i> Document</span>' : ''}
              ${checkin.popgift_flag ? '<span style="background: #E91E63; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px;"><i class="material-icons" style="font-size: 12px; vertical-align: middle;">card_giftcard</i> Gift</span>' : ''}
            </div>
          </div>
        ` : ''}

        <!-- Coordinates -->
        <div style="background: #fafafa; padding: 8px; border-radius: 6px; font-size: 12px; color: #666;">
          <i class="material-icons" style="font-size: 14px; vertical-align: middle;">my_location</i>
          ${checkin.start_lat.toFixed(6)}, ${checkin.start_lng.toFixed(6)}
        </div>

      </div>
    </div>
  `;
}

// Helper function to calculate duration between two datetime strings
public calculateDuration(start: string, end: string): string {
  const startTime = moment(start);
  const endTime = moment(end);
  const duration = moment.duration(endTime.diff(startTime));
  
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} minutes`;
}

// Helper function to format seconds to readable time
private formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} minutes`;
}

  findCheckinById(checkinId: string): any {
    if (!this.checkin || !checkinId) return null;
    return this.checkin.find(c => c.id === checkinId);
  }


  private fitMapToBounds(): void {
    if (this.locationMarkers.length > 0) {
      const coords: [number, number][] = this.locationMarkers.map(
        (loc): [number, number] => [loc.lat, loc.lng]
      );
      const group = new L.featureGroup(coords.map(coord => L.marker(coord)));
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  // Update destroyExistingMap to clean up TrackPlayer
  private destroyExistingMap(): void {
    // Stop and remove TrackPlayer
    if (this.trackPlayer) {
      this.trackPlayer.pause();
      this.trackPlayer.remove();
      this.trackPlayer = null;
    }
    
    // Clear interval
    this.stopProgressInterval();
    
    // Remove routing control if exists
    if (this.routingControl) {
      this.map.removeControl(this.routingControl);
      this.routingControl = null;
    }
    
    // Remove map
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  toggleSpeedControl() {
    this.showSpeedControl = !this.showSpeedControl
  }

  playbackDelay = 1000; // default delay in ms

  // Replace existing updateSpeed method
  updateSpeed(event: any): void {
    console.log(event.target.value, "line 953")
    const sliderValue = parseInt(event.target.value, 10);
    this.playbackDelay = sliderValue;

    // Map slider [300–5000] → speed multiplier [5x–0.3x]
    const minDelay = 30;
    const maxDelay = 500;
    const minSpeed = 0.3;
    const maxSpeed = 5;

    const normalized = (sliderValue - minDelay) / (maxDelay - minDelay);
    this.playbackSpeed = maxSpeed - normalized * (maxSpeed - minSpeed);

    // Update TrackPlayer speed if it exists
    if (this.trackPlayer) {
      this.trackPlayer.setSpeed(sliderValue);
    }

    console.log('Delay (ms):', this.playbackDelay, 'Speed:', this.playbackSpeed);

    // If playback is currently running, restart with new speed
    if (this.playbackStatus === 'playing') {
      this.pausePlayback();
      setTimeout(() => {
        this.startPlayback();
      }, 100);
    }
  }

  // Initialize playback control with reasonable defaults
  private initializePlaybackControl(): void {
    this.playbackControl = {
      speed: 500, // Faster default for smoother road following
      progress: 0,
      status: 'stopped',
      start: () => this.startPlayback(),
      pause: () => this.pausePlayback()
    };

    this.playbackSpeed = 500; // 500ms intervals for smooth movement
  }

  // Preset speed controls
  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = speed;

    if (this.playbackStatus === 'playing') {
      this.pausePlayback();
      setTimeout(() => {
        this.startPlayback();
      }, 100);
    }
  }

  private renderBatteryChart(): void {
    console.log('Battery chart data ready:', this.batteryData);
  }

  onDateChange(): void {
    this.isMapLoading = true;
    this.locationMarkers = [];

    // Clear live tracking if switching away from today
    if (this.liveTrackingInterval) {
      clearInterval(this.liveTrackingInterval);
      this.liveTrackingInterval = null;
    }

    console.log(this.selectedDate, "Date changed");
    this.loadLocationData();
    this.UserInformation();
    this.UserInformationDetail();
    this.loadGetDayActivityTimeline()
    this.loadGetPermissionReport()

    // Reset playback state
    this.roadRouteCoordinates = [];
    this.currentPlaybackIndex = 0;
  }

  refreshData(): void {
    // this.isLoading = true;
    this.isMapLoading = true;
    this.locationMarkers = []
    // Reset route data
    this.roadRouteCoordinates = [];
    this.currentPlaybackIndex = 0;

    setTimeout(() => {
      this.initializeData();
      if (this.activeTab === 'live' || this.activeTab === 'playback') {
        this.switchTab(this.activeTab);
      }
    }, 1000);
  }

  getMarkerClass(type: string): string {
    const classMap: { [key: string]: string } = {
      'Checkin': 'checkin',
      'Checkout': 'checkout',
      'Attendence Start': 'attendance',
      'Current Position': 'current',
      'Checkpoint': 'checkpoint',
      'Background': 'background'
    };
    return classMap[type] || 'background';
  }

  getMarkerIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'Checkin': 'where_to_vote',
      'Checkout': 'pin_drop',
      'Attendence Start': 'play_arrow',
      'Current Position': 'my_location',
      'Checkpoint': 'place',
      'Background': 'person_pin_circle'
    };
    return iconMap[type] || 'place';
  }

  formatLocationTypeName(type: string): string {
    return type.replace('_', ' ');
  }



  getHealthScoreClass(score: number | string): string {
    const numericScore = Number(score);
    if (numericScore >= 80) return 'score-good';
    if (numericScore >= 50) return 'score-medium';
    return 'score-poor';
  }

  getCheckinTime(record: LocationData): string | null {
    return record.timestamp;
  }

  getCheckoutTime(record: LocationData): string | null {
    return record.visit_end || null;
  }

  // Update clearIntervals method
  private clearIntervals(): void {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
    }
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
    }
    // Clear live tracking interval
    if (this.liveTrackingInterval) {
      clearInterval(this.liveTrackingInterval);
      this.liveTrackingInterval = null;
    }
    // Clear TrackPlayer interval
    this.stopProgressInterval();
  }

  // Reset playback to beginning
  resetPlayback(): void {
    if (!this.trackPlayer) {
      // If no TrackPlayer, use old method
      this.pausePlayback();
      this.playbackProgress = 0;
      this.currentPlaybackIndex = 0;

      if (this.playbackMarker && this.roadRouteCoordinates.length > 0) {
        const startPoint = this.roadRouteCoordinates[0];
        this.playbackMarker.setLatLng([startPoint[0], startPoint[1]]);
        this.playbackDateTime = moment(this.locationMarkers[0].timestamp);
      }
      return;
    }

    // Use TrackPlayer reset
    this.pausePlayback();
    this.playbackProgress = 0;
    this.trackPlayer.setProgress(0);
    
    if (this.locationMarkers.length > 0) {
      this.playbackDateTime = moment(this.locationMarkers[0].timestamp || this.locationMarkers[0].date_created);
    }
  }

  // Jump to specific location marker
  jumpToMarker(markerIndex: number): void {
    if (markerIndex < 0 || markerIndex >= this.locationMarkers.length) return;

    const targetMarker = this.locationMarkers[markerIndex];

    // Calculate approximate progress based on marker position
    const progressRatio = markerIndex / (this.locationMarkers.length - 1);
    this.playbackProgress = progressRatio * 100;

    // If TrackPlayer exists, use it
    if (this.trackPlayer) {
      this.trackPlayer.setProgress(progressRatio);
    } else {
      // Find closest point on road route
      if (this.roadRouteCoordinates.length > 0) {
        this.currentPlaybackIndex = Math.floor(progressRatio * (this.roadRouteCoordinates.length - 1));

        if (this.playbackMarker) {
          const routePoint = this.roadRouteCoordinates[this.currentPlaybackIndex];
          this.playbackMarker.setLatLng([routePoint[0], routePoint[1]]);
        }
      }
    }

    // Update datetime
    this.playbackDateTime = moment(targetMarker.timestamp || targetMarker.date_created);

    // Pan map to location
    this.map.panTo([targetMarker.lat, targetMarker.lng], {
      animate: true,
      duration: 1
    });
  }

  // Get current playback location info
  getCurrentPlaybackInfo(): any {
    if (this.roadRouteCoordinates.length === 0 || this.currentPlaybackIndex >= this.roadRouteCoordinates.length) {
      return null;
    }

    const currentPoint = this.roadRouteCoordinates[this.currentPlaybackIndex];
    const progressRatio = this.playbackProgress / 100;

    // Find nearest location marker
    let nearestMarkerIndex = Math.floor(progressRatio * (this.locationMarkers.length - 1));
    nearestMarkerIndex = Math.min(nearestMarkerIndex, this.locationMarkers.length - 1);

    return {
      coordinates: currentPoint,
      progress: this.playbackProgress,
      timestamp: this.playbackDateTime,
      nearestMarker: this.locationMarkers[nearestMarkerIndex],
      routeIndex: this.currentPlaybackIndex
    };
  }

  // Add method to export tracking data
  exportTrackingData(): any {
    return {
      employee: this.employeeData,
      locations: this.locationMarkers,
      route: this.roadRouteCoordinates,
      totalDistance: this.totalDistance,
      trackingAccuracy: this.trackingAccuracy,
      date: this.selectedDate,
      exportedAt: moment().toISOString()
    };
  }

  // Add method to get route statistics
  getRouteStatistics(): any {
    if (this.roadRouteCoordinates.length < 2) return null;

    let totalRouteDistance = 0;
    for (let i = 1; i < this.roadRouteCoordinates.length; i++) {
      const prev = this.roadRouteCoordinates[i - 1];
      const curr = this.roadRouteCoordinates[i];

      // Use the helper method for distance calculation
      totalRouteDistance += this.calculateDistance(prev, curr);
    }

    return {
      totalPoints: this.roadRouteCoordinates.length,
      calculatedDistance: totalRouteDistance.toFixed(2) + ' km',
      reportedDistance: this.totalDistance + ' km',
      averageSpeed: this.calculateAverageSpeed(),
      duration: this.calculateTotalDuration()
    };
  }

  private calculateAverageSpeed(): string {
    if (this.locationMarkers.length < 2) return '0 km/h';

    const startTime = moment(this.locationMarkers[0].timestamp || this.locationMarkers[0].date_created);
    const endTime = moment(this.locationMarkers[this.locationMarkers.length - 1].timestamp || this.locationMarkers[this.locationMarkers.length - 1].date_created);
    const durationHours = endTime.diff(startTime, 'hours', true);

    if (durationHours === 0) return '0 km/h';

    const avgSpeed = parseFloat(this.totalDistance) / durationHours;
    return avgSpeed.toFixed(1) + ' km/h';
  }

  private calculateTotalDuration(): string {
    if (this.locationMarkers.length < 2) return '0 minutes';

    const startTime = moment(this.locationMarkers[0].timestamp || this.locationMarkers[0].date_created);
    const endTime = moment(this.locationMarkers[this.locationMarkers.length - 1].timestamp || this.locationMarkers[this.locationMarkers.length - 1].date_created);
    const duration = moment.duration(endTime.diff(startTime));

    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
  }

  // Add this method to load users list
  searchTerm: string = '';

  loadUsersList(): void {
    this.isLoadingUsers = true;

    const payload = { search: this.searchTerm || '' };

    this.service.post_rqst(payload, "CustomerNetwork/salesUserList")
      .subscribe(
        (result) => {
          this.userList = result['all_sales_user'] || [];
          this.isLoadingUsers = false;
        },
        (error) => {
          console.error('Error loading users:', error);
          this.isLoadingUsers = false;
        }
      );
  }

  loadLiveLocationData(): void {
    const userIdToUse = this.selectedUserId || this.payload.user_id;

    let header = {
      'date': this.selectedDate,
      'user_id': userIdToUse
    };

    this.service.post_rqst(header, "BackgroundLocationTimeline/getLiveLocation")
      .subscribe(
        (result) => {
          this.userLocationsData = result['locations'] || [];
        },
        (error) => {
          console.error('Error loading users:', error);
          this.isLoadingUsers = false;
        }
      );
  }

  loadLocationTimeLine(): void {
    const userIdToUse = this.selectedUserId || this.payload.user_id;
    let header = {
      'date': this.selectedDate,
      'user_id': userIdToUse
    };

    this.service.post_rqst(header, "BackgroundLocationTimeline/generateDailyTimeline")
      .subscribe(
        (result) => {
          this.timelineData = result || {};
          this.timelineEvents = result['timeline'] || [];
          this.timelineInsights = result['insights'] || {};
          this.timeline_gaps = result['analytics'].timeline_gaps || [];

          let visitCounter = 1;
          this.timelineEvents.forEach(event => {
            if (event.type === 'visit') {
              event.visit_count = visitCounter++;
            }
          });
        },
        (error) => {
          console.error('Error loading timeline:', error);
        }
      );
  }

  loadGetDayActivityTimeline(): void {
    const userIdToUse = this.selectedUserId || this.payload.user_id;
    let header = {
      'date': this.selectedDate,
      'user_id': userIdToUse
    };

    this.service.post_rqst(header, "BackgroundLocationTimeline/getDayActivityTimeline")
      .subscribe(
        (result) => {
          this.timelineCheckin = result['timeline'] || [];
          this.summaryTimelineCheckin = result['distances'] || {};
          console.log(this.timelineCheckin, "this.timelineCheckin")
        },
        (error) => {
          console.error('Error loading timeline:', error);
        }
      );
  }
  loadGetPermissionReport(): void {
  const userIdToUse = this.selectedUserId || this.payload.user_id;
  let header = {
    'date': this.selectedDate,
    'user_id': userIdToUse
  };

  this.service.post_rqst(header, "BackgroundLocationReport/getReport")
    .subscribe(
      (result) => {
        this.permissionsData = result || {};
       this.permissionsList = result.health_issues.issue_periods || [];
       if(this.permissionsList.length > 0){
       this.showPermissionsDisclaimer=true
       }
    
        this.groupPermissionsByHour();
        this.calculateHourlyStats();
        console.log('Permissions data:', this.permissionsData);
      },
      (error) => {
        console.error('Error loading permissions report:', error);
      }
    );
}

groupPermissionsByHour(): void {
  this.groupedPermissions = {};
  
  this.permissionsList.forEach(permission => {
    if (permission.timestamp) {
      const hour = new Date(permission.timestamp).getHours();
      const hourKey = `${hour.toString().padStart(2, '0')}:00`;
      
      if (!this.groupedPermissions[hourKey]) {
        this.groupedPermissions[hourKey] = [];
      }
      
      this.groupedPermissions[hourKey].push(permission);
    }
  });
  
  // Set first hour as selected if none selected
  const hours = Object.keys(this.groupedPermissions);
  if (hours.length > 0 && !this.selectedHour) {
    this.selectedHour = hours[0];
  }
}

calculateHourlyStats(): void {
  this.hourlyStats = {};
  
  Object.keys(this.groupedPermissions).forEach(hour => {
    const permissions = this.groupedPermissions[hour];
    const granted = permissions.filter(p => p.status === 'granted').length;
    const denied = permissions.filter(p => p.status === 'denied').length;
    
    this.hourlyStats[hour] = {
      total: permissions.length,
      granted: granted,
      denied: denied,
      grantedPercentage: permissions.length > 0 ? Math.round((granted / permissions.length) * 100) : 0
    };
  });
}



getSelectedHourPermissions(): any[] {
  return this.groupedPermissions[this.selectedHour] || [];
}



getHoursList(): string[] {
  return Object.keys(this.groupedPermissions).sort();
}



getGrantedCount(): number {
  return this.permissionsList.filter(p => p.status === 'granted').length;
}

getDeniedCount(): number {
  return this.permissionsList.filter(p => p.status === 'denied').length;
}

getPermissionIcon(permissionName: string): string {
  const iconMap: any = {
    'location': 'location_on',
    'camera': 'camera_alt',
    'microphone': 'mic',
    'storage': 'storage',
    'phone': 'phone',
    'contacts': 'contacts',
    'sms': 'sms',
    'calendar': 'event',
    'background_location': 'my_location',
    'notification': 'notifications',
    'battery_optimization': 'battery_std'
  };
  
  const key = permissionName.toLowerCase().replace(/[^a-z]/g, '_');
  return iconMap[key] || 'security';
}

formatPermissionName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

getPermissionDescription(permissionName: string): string {
  const descriptions: any = {
    'location': 'Required for tracking user location',
    'background_location': 'Allows location tracking when app is closed',
    'camera': 'Needed for taking photos and scanning',
    'storage': 'Required to save data and images locally',
    'notification': 'Used to send important alerts and updates',
    'battery_optimization': 'Prevents system from stopping the app'
  };
  
  const key = permissionName.toLowerCase().replace(/[^a-z]/g, '_');
  return descriptions[key] || 'This permission is required for app functionality';
}












formatIssueText(issue: string): string {
   return issue.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  // return ;
}






// Enhanced methods for modern design

getHourlyStatuses(hour: string): {
  total: number, 
  granted: number, 
  denied: number, 
  avgBattery: number,
  totalIssues: number,
  criticalIssues: number,
  batteryStatus: string
} {
  const permissions = this.groupedPermissions[hour] || [];
  const granted = permissions.filter(p => p.status === 'granted').length;
  const denied = permissions.filter(p => p.status === 'denied').length;
  
  // Calculate average battery level
  const totalBattery = permissions.reduce((sum, p) => sum + (p.battery_level || 0), 0);
  const avgBattery = permissions.length > 0 ? Math.round(totalBattery / permissions.length) : 0;
  
  // Calculate issues
  const totalIssues = permissions.reduce((sum, p) => sum + (p.issues.length || 0), 0);
  const criticalIssues = permissions.filter(p => this.isCritical(p)).length;
  
  // Determine battery status class
  let batteryStatus = 'good';
  if (avgBattery <= 20) batteryStatus = 'critical';
  else if (avgBattery <= 50) batteryStatus = 'warning';
  
  return {
    total: permissions.length,
    granted,
    denied,
    avgBattery,
    totalIssues,
    criticalIssues,
    batteryStatus
  };
}

// Enhanced battery colors with modern palette
getBatteryColor(level: number): string {
  if (level <= 15) return '#ef4444'; // Modern red
  if (level <= 30) return '#f59e0b'; // Modern amber
  if (level <= 50) return '#eab308'; // Modern yellow
  if (level <= 80) return '#22c55e'; // Modern green
  return '#10b981'; // Modern emerald
}

// Enhanced battery icons
getBatteryIcon(level: number): string {
  if (level <= 15) return 'battery_alert';
  if (level <= 30) return 'battery_2_bar';
  if (level <= 50) return 'battery_3_bar';
  if (level <= 80) return 'battery_5_bar';
  return 'battery_full';
}

// Enhanced issue colors for modern design
getIssueColor(issue: string): string {
  const colorMap: any = {
    'POWER_SAVE_ON': 'orange',
    'LOW_BATTERY': 'red',
    'LOCATION_OFF': 'red',
    'GPS_OFF': 'red',
    'BACKGROUND_RESTRICTED': 'orange',
    'WIFI_DISABLED': 'orange',
    'INTERNET_OFF': 'orange'
  };
  return colorMap[issue] || 'gray';
}

// Enhanced issue icons with more modern alternatives
getIssueIcon(issue: string): string {
  const iconMap: any = {
    'POWER_SAVE_ON': 'power_settings_new',
    'LOW_BATTERY': 'battery_alert',
    'LOCATION_OFF': 'location_disabled',
    'GPS_OFF': 'gps_off',
    'BACKGROUND_RESTRICTED': 'block',
    'WIFI_DISABLED': 'wifi_off',
    'INTERNET_OFF': 'signal_cellular_connected_no_internet_0_bar'
  };
  return iconMap[issue] || 'error_outline';
}

// Enhanced critical detection
isCritical(record: any): boolean {
  // Critical if battery is very low
  if (record.battery_level <= 15) {
    return true;
  }

  // Critical if location/GPS issues exist
  if (record.issues && Array.isArray(record.issues)) {
    const criticalIssues = ['LOCATION_OFF', 'GPS_OFF', 'LOW_BATTERY'];
    return record.issues.some(issue => criticalIssues.includes(issue));
  }

  return false;
}

// Smooth hour selection with animation support
selectHour(hour: string): void {
  this.selectedHour = hour;
  
  // Optional: Add smooth scroll to details panel
  setTimeout(() => {
    const detailsPanel = document.querySelector('.permissions-details');
    if (detailsPanel) {
      detailsPanel.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, 100);
}


  // Add this method to handle user selection change
  onUserChange(): void {
    if (this.selectedUserId) {
      this.isMapLoading = true
      console.log('Selected user ID:', this.selectedUserId);

      // Update the payload with selected user
      // this.payload.user_id = this.selectedUserId;
      this.userId = this.selectedUserId;

      // Reload data for selected user
      this.loadLocationData();
      this.UserInformation();
        this.UserInformationDetail();
      this.loadGetDayActivityTimeline()
       this.loadGetPermissionReport()

      // Refresh the current tab
      if (this.activeTab === 'summary') {
        this.loadAttendanceSummary();
      }
    }
  }

  toggleRoadChange() {
    console.log(this.snapToRoad, "line  1401")
    if (this.snapToRoad == true) {
      this.getRouteEstimated()
    } else {
      this.loadLocationData()
    }
  }

  private loadLocationData(): void {
    this.isMapLoading = true;
    this.locationMarkers = []
    this.missingPermissions = [];
    this.missingPermissionsCount = 0;
    this.snapToRoad = false
    // Use selected user ID or default from payload
    const userIdToUse = this.selectedUserId || this.payload.user_id;

    let header = {
      'date': this.selectedDate,
      'user_id': userIdToUse
    };

    this.service.post_rqst(header, "BackgroundLocationProcess/getDailyReportCalculated")
      .subscribe((result => {
        this.locationMarkers = result.route.points
        this.total_distance = result.route.distance_km
        this.checkinKM = result.route.checkin_to_checkin_km

        this.oldFlag = result.old_data
        console.log(this.oldFlag, "this.oldFlag")

        if (this.locationMarkers.length > 0) {
          setTimeout(() => {
            // Switch to appropriate tab based on date
            if (this.isToday()) {
              this.switchTab('live');
            } else {
              this.switchTab('route');
            }
            this.isLoading = false;
          }, 1000);
        } else {
          this.isMapLoading = false;
        }

        this.latestLocation = {
          lat: this.locationMarkers[0].lat,
          lng: this.locationMarkers[0].lng,
          gps: 'Sector 21, Faridabad',
          time: moment().toISOString(),
          total_checkin: this.locationData.length
        };

        this.calculateTotalDistance();
      }));

    this.isLoading = false;
  }

  private UserInformation(): void {
    this.isMapLoading = true;
    this.locationMarkers = []
    this.missingPermissions = [];
    this.missingPermissionsCount = 0;
    this.snapToRoad = false
    // Use selected user ID or default from payload
    const userIdToUse = this.selectedUserId || this.payload.user_id;

    let header = {
      'date': this.selectedDate,
      'user_id': userIdToUse
    };

    this.service.post_rqst(header, "BackgroundLocationProcess/getDailyReportAdditionalDetails")
      .subscribe((result => {
        this.employeeData = result.user;
        this.summarizeData = result.device_health;
        this.checkin = result.checkins
        this.attendanceData = result.attendance

     if(this.attendanceData){
  let stopTime = this.attendanceData.stop_time;
if (!stopTime || stopTime === '00:00:00') {

    if (this.isToday()) {
      // Use current time if it's today
      stopTime = moment().format('HH:mm:ss');
    } else {
      // Use 11:55 PM if it's not today
      stopTime = '23:55:00';
    }
  }
  
  // Calculate the difference using moment duration
  const startMoment = moment(this.attendanceData.start_time, 'HH:mm:ss');
  const stopMoment = moment(stopTime, 'HH:mm:ss');
  const duration = moment.duration(stopMoment.diff(startMoment));
  
  // Format as "Xh Ym" or "X hours Y minutes"
  const hours = Math.floor(duration.asHours());
  const minutes = duration.minutes();
  
  this.activeTime = `${hours}h ${minutes}m`;
  
}

        this.calculateMissingPermissions()
        if (this.summarizeData) {
          try {
            this.summarizeData.device_issues_array = this.summarizeData.device_issues ? JSON.parse(this.summarizeData.device_issues) : [];
          } catch (e) {
            console.error("Could not parse device_issues", e);
            this.summarizeData.device_issues_array = [this.summarizeData.device_issues];
          }
          try {
            this.summarizeData.recommendations_array = this.summarizeData.recommendations ? JSON.parse(this.summarizeData.recommendations) : [];
          } catch (e) {
            console.error("Could not parse recommendations", e);
            this.summarizeData.recommendations_array = [this.summarizeData.recommendations];
          }
        }
        this.debugFlag = result.debug;

        if(result.route){
 this.locationMarkers = result.route.points
        this.total_distance = result.route.distance_km
        }
       

        if (this.locationMarkers.length > 0) {
          setTimeout(() => {
            this.switchTab('live');
            this.isLoading = false;
          }, 1000);
        } else {
          this.isMapLoading = false;
        }

        this.latestLocation = {
          lat: this.locationMarkers[0].lat,
          lng: this.locationMarkers[0].lng,
          gps: 'Sector 21, Faridabad',
          time: moment().toISOString(),
          total_checkin: this.locationData.length
        };

        this.calculateTotalDistance();
      }));

    this.isLoading = false;
  }

  private UserInformationDetail(): void {
   
    
    // Use selected user ID or default from payload
    const userIdToUse = this.selectedUserId || this.payload.user_id;

    let header = {
      'date': this.selectedDate,
      'user_id': userIdToUse
    };

    this.service.post_rqst(header, "Attendance/attendanceSummary")
      .subscribe((result => {

        // Assign new sales & performance data
        this.TC = result.TC;
        this.PC = result.PC;
        this.secondary_sale_amount = result.secondary_sale_amount;
        this.New_Counter = result.New_Counter;
        this.New_counter_TC = result.New_counter_TC;
        this.New_counter_PC = result.New_counter_PC;
        this.counter_primary_Value = result.counter_primary_Value;
        this.counter_secondary_Value = result.counter_secondary_Value;
        this.baseLat = result.base_lat;
        this.baseLng= result.base_lng;
        this.attendanceVariation = result.base_km_diff
;

       

       

       
       
      }));

    
  }

  parseDateTime(dateTimeStr: string): Date {
    return new Date(dateTimeStr.replace(" ", "T"));
    // replace space with 'T' to make it ISO compatible
  }

  getRouteEstimated() {
    console.log("line 1402")
    this.isMapLoading = true;
    this.locationMarkers = []
    // Use selected user ID or default from payload
    const userIdToUse = this.selectedUserId || this.payload.user_id;

    let header = {
      'date': this.selectedDate,
      'user_id': userIdToUse
    };

    this.service.post_rqst(header, "BackgroundLocationProcess/getDailyReportSnapped")
      .subscribe((result => {
        this.locationMarkers = result.route.points
        this.total_distance = result.route.distance_km
        if (this.locationMarkers.length > 0) {
          setTimeout(() => {
            this.switchTab('route');
            this.isLoading = false;
          }, 1000);
        }
      }));
  }

  private calculateMissingPermissions(): void {
    this.missingPermissions = [];

    if (!this.summarizeData) {
      this.missingPermissionsCount = 0;
      return;
    }

    // Permissions that should be enabled (true/1)
    if (!this.summarizeData.has_background_permission) {
      this.missingPermissions.push('Background Permission Not Granted');
    }
    if (!this.summarizeData.fine_location) {
      this.missingPermissions.push('Fine Location Access Not Granted');
    }
    if (!this.summarizeData.is_location_enabled) {
      this.missingPermissions.push('Location Services are Disabled');
    }
    if (!this.summarizeData.is_gps_enabled) {
      this.missingPermissions.push('GPS is Disabled');
    }

    // Settings that should be disabled (false/0)
    if (this.summarizeData.is_battery_optimized) {
      this.missingPermissions.push('App is Battery Optimized (should be unrestricted)');
    }
    if (this.summarizeData.is_power_save_mode) {
      this.missingPermissions.push('Power Saving Mode is On');
    }

    this.missingPermissionsCount = this.missingPermissions.length;

    console.log('Missing Permissions:', this.missingPermissions);
    console.log('Missing Permissions Count:', this.missingPermissionsCount);
  }

  showAlert: boolean = false;
  showMeterAlert: boolean = false;

  showMissingPermissions(): void {
    if (this.missingPermissionsCount > 0) {
      this.showAlert = true;
    }
  }

  closeAlert(): void {
    this.showAlert = false;
  }

  showMeterDistance(): void {
    this.showMeterAlert = true;
  }

  closeMeterAlert(): void {
    this.showMeterAlert = false;
  }

  resolveIssues(): void {
    // Implement resolution logic here
    console.log('Resolving issues...');
    this.closeAlert();
  }

  onFullscreenToggle(): void {
    // Give the DOM a moment to update with the new class and for the map container to resize.
    // This ensures Leaflet recalculates its size based on the new container dimensions.
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize(true); // pass true for animation
      }
    }, 300); // A delay helps to run this after CSS transitions.
  }

  // Add these properties first
  autoRefreshLiveUsers: boolean = false;
  isLoadingLiveUsers: boolean = false;
  liveUsersMap: any;

  // Live Users Methods
  private initializeLiveUsersMap(): void {
    setTimeout(() => {
      if (this.liveUsersMap) {
        this.liveUsersMap.remove();
        this.liveUsersMap = null;
      }

      // Create map centered on Faridabad
      this.liveUsersMap = L.map('liveUsersMap').setView([28.395975, 77.316355], 13);

      // Add tile layer
      L.tileLayer('http://{s}.google.com/vt?lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(this.liveUsersMap);

      // Load live users data
      this.loadLiveUsersData();
    }, 100);
  }

  loadLiveUsersData(): void {
    this.isLoadingLiveUsers = true;
    
    const userIdToUse = this.selectedUserId || this.payload.user_id;
    let header = {
      'date': this.selectedDate,
      'user_id': userIdToUse
    };

    this.service.post_rqst(header, "BackgroundLocationTimeline/getLiveLocation")
      .subscribe(
        (result) => {
          this.liveUsersData = result['locations'] || [];
          this.updateLiveUsersOnMap();
          this.isLoadingLiveUsers = false;
        },
        (error) => {
          console.error('Error loading live users:', error);
          this.isLoadingLiveUsers = false;
        }
      );
  }

  updateLiveUsersOnMap(): void {
    if (!this.liveUsersMap) return;

    // Clear existing markers
    this.liveUsersMarkers.forEach(marker => {
      this.liveUsersMap.removeLayer(marker);
    });
    this.liveUsersMarkers = [];

    // Add markers for each user
    this.liveUsersData.forEach(userData => {
      if (!userData.location) return;

      const isSelected = this.selectedLiveUsers.size === 0 || 
                        this.selectedLiveUsers.has(userData.user.id.toString());
      
      if (!isSelected) return;

      // Create custom icon based on user status
      const iconHtml = this.createUserMarkerHtml(userData);
      const icon = L.divIcon({
        className: 'live-user-marker',
        html: iconHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      // Create marker
      const marker = L.marker([userData.location.lat, userData.location.lng], { icon })
        .addTo(this.liveUsersMap);

      // Add popup with user details
      const popupContent = this.createUserPopupContent(userData);
      marker.bindPopup(popupContent);

      // Add accuracy circle if available
      if (userData.location.accuracy) {
        const circle = L.circle([userData.location.lat, userData.location.lng], {
          radius: userData.location.accuracy,
          color: this.getStatusColor(userData.status),
          fillColor: this.getStatusColor(userData.status),
          fillOpacity: 0.1,
          weight: 1
        }).addTo(this.liveUsersMap);
        
        this.liveUsersMarkers.push(circle);
      }

      this.liveUsersMarkers.push(marker);
    });

    // Fit map to show all markers
    if (this.liveUsersMarkers.length > 0) {
      const group = new L.featureGroup(this.liveUsersMarkers);
      this.liveUsersMap.fitBounds(group.getBounds().pad(0.1));
    }
  }

  createUserMarkerHtml(userData: any): string {
    const color = this.getStatusColor(userData.status);
    const isMoving = userData.movement.is_moving;
    
    return `
      <div style="
        background: ${color};
        color: white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
      ">
        <i class="material-icons" style="font-size: 20px;">
          ${isMoving ? 'directions_walk' : 'person_pin'}
        </i>
        ${userData.device.battery_level < 20 ? 
          '<span style="position: absolute; top: -5px; right: -5px; background: red; width: 10px; height: 10px; border-radius: 50%;"></span>' 
          : ''}
      </div>
    `;
  }

  createUserPopupContent(userData: any): string {
    return `
      <div style="min-width: 250px;">
        <h4 style="margin: 0 0 10px 0; color: #333;">
          ${userData.user.name || 'Unknown User'}
        </h4>
        <div style="display: grid; gap: 5px; font-size: 14px;">
          <div><strong>ID:</strong> ${userData.user.employee_id || 'N/A'}</div>
          <div><strong>Status:</strong> 
            <span style="
              background: ${this.getStatusColor(userData.status)};
              color: white;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 12px;
            ">${userData.status}</span>
          </div>
          <div><strong>Activity:</strong> ${userData.movement.activity}</div>
          <div><strong>Speed:</strong> ${userData.movement.speed || 0} km/h</div>
          <div><strong>Battery:</strong> ${userData.device.battery_level}%</div>
          <div><strong>Accuracy:</strong> ${userData.location.accuracy}m</div>
          <div><strong>Last Update:</strong> ${userData.device.last_update}</div>
          ${userData.attendance.status ? 
            `<div><strong>Attendance:</strong> ${userData.attendance.status}</div>` 
            : ''}
        </div>
      </div>
    `;
  }

  getStatusColor(status: string): string {
    const colors: any = {
      'stationary': '#4CAF50',
      'idle': '#FF9800',
      'moving': '#2196F3',
      'offline': '#9E9E9E',
      'unknown': '#795548'
    };
    return colors[status] || '#795548';
  }

  toggleUserSelection(userId: string): void {
    if (this.selectedLiveUsers.has(userId)) {
      this.selectedLiveUsers.delete(userId);
    } else {
      this.selectedLiveUsers.add(userId);
    }
    this.updateLiveUsersOnMap();
  }

  getActiveUsersCount(): number {
    return this.liveUsersData.filter(u => u.movement.is_moving).length;
  }

  centerMapOnUsers(): void {
    if (this.liveUsersMarkers.length > 0 && this.liveUsersMap) {
      const group = new L.featureGroup(this.liveUsersMarkers);
      this.liveUsersMap.fitBounds(group.getBounds().pad(0.1));
    }
  }

  refreshLiveUsers(): void {
    this.loadLiveUsersData();
  }

  toggleAutoRefresh(): void {
    if (this.autoRefreshLiveUsers) {
      this.liveUsersUpdateInterval = setInterval(() => {
        this.loadLiveUsersData();
      }, 30000); // Refresh every 30 seconds
    } else {
      if (this.liveUsersUpdateInterval) {
        clearInterval(this.liveUsersUpdateInterval);
        this.liveUsersUpdateInterval = null;
      }
    }
  }

  getTimelineIcon(type: string): string {
    const icons: any = {
      'attendance_start': 'play_circle_filled',
      'attendance_stop': 'stop_circle',
      'travel': 'directions_car',
      'stop': 'store',
      'visit': 'person_pin_circle'
    };
    return icons[type] || 'place';
  }

  getTimelineEventClass(type: string): string {
    const classes: any = {
      'attendance_start': 'event-start',
      'attendance_stop': 'event-stop',
      'travel': 'event-travel',
      'stop': 'event-visit',
      'visit': 'event-checkin',
      'checkout': 'event-checkout'
    };
    return classes[type] || 'event-default';
  }

  hasTimelineGap(index: number): boolean {
    if (!this.timeline_gaps || index >= this.timelineEvents.length - 1) return false;
    
    const currentEvent = this.timelineEvents[index];
    const nextEvent = this.timelineEvents[index + 1];
    
    return this.timeline_gaps.some(gap => 
      gap.start === currentEvent.time || gap.start === currentEvent.end_time
    );
  }

  getGapDuration(index: number): number {
    if (!this.timeline_gaps) return 0;
    
    const currentEvent = this.timelineEvents[index];
    const gap = this.timeline_gaps.find(g => 
      g.start === currentEvent.time || g.start === currentEvent.end_time
    );
    
    return gap ? gap.duration_minutes : 0;
  }

  private initializeTimelineMapView(): void {
    if (!this.timelineEvents || this.timelineEvents.length === 0) return;

    // Destroy existing map if it exists
    if (this.timelineMapView) {
      this.timelineMapView.remove();
      this.timelineMapView = null;
    }

    // Get first location for center
    let centerLat = 28.395975;
    let centerLng = 77.316355;
    
    const firstLocationEvent = this.timelineEvents.find(e => e.location);
    if (firstLocationEvent && firstLocationEvent.location) {
      centerLat = firstLocationEvent.location.lat;
      centerLng = firstLocationEvent.location.lng;
    }

    // Create map
    this.timelineMapView = L.map('timelineMapView').setView([centerLat, centerLng], 12);

    // Add tile layer
    L.tileLayer('http://{s}.google.com/vt?lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(this.timelineMapView);

    const markers: any[] = [];
    
    // Add markers for important events
    this.timelineEvents.forEach((event, index) => {
      // Show start, stop, location_stop, and checkin events
      if (event.type === 'attendance_start' ||
          event.type === 'attendance_stop' ||
          event.type === 'stop' ||
          event.type === 'visit' ||
          event.type === 'checkout') {
        
        if (event.location) {
          const marker = this.createTimelineEventMarker(event, index);
          if (marker) {
            markers.push(marker);
          }
        }
      }
    });

    // Fit map to show all markers
    if (markers.length > 0) {
      const group = new L.featureGroup(markers);
      this.timelineMapView.fitBounds(group.getBounds().pad(0.1));
    }
  }

  private createTimelineEventMarker(event: any, index: number): any {
    if (!event.location) return null;

    let iconColor = '#757575';
    let iconName = 'place';
    let markerTitle = event.title;
    
    if (event.type === 'attendance_start') {
      iconColor = '#4CAF50';
      iconName = 'play_circle_filled';
      markerTitle = 'Day Start';
    } else if (event.type === 'attendance_stop') {
      iconColor = '#f44336';
      iconName = 'stop_circle';
      markerTitle = 'Day End';
    } else if (event.type === 'stop') {
      iconColor = '#9C27B0';
      iconName = 'store';
      markerTitle = 'Stoppage';
    } else if (event.type === 'visit') {
      iconColor = '#00BCD4';
      iconName = 'where_to_vote';
      markerTitle = 'Check In';
    } else if (event.type === 'checkout') {
      iconColor = '#FF5722';
      iconName = 'exit_to_app';
      markerTitle = 'Check Out';
    }
    
    const icon = L.divIcon({
      className: 'timeline-marker-div',
      html: `
        <div style="
          background: ${iconColor};
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 3px 10px rgba(0,0,0,0.4);
          position: relative;
        ">
          <i class="material-icons" style="font-size: 22px;">${iconName}</i>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    const marker = L.marker([event.location.lat, event.location.lng], { icon })
      .addTo(this.timelineMapView);

    // Enhanced popup content
    const popupContent = `
      <div style="min-width: 280px; max-width: 350px;">
        <h3 style="margin: 0 0 10px 0; color: ${iconColor};">${event.title}</h3>
        <div style="display: grid; gap: 10px; font-size: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="material-icons" style="font-size: 18px; color: #666;">access_time</i>
            <span><strong>Time:</strong> ${event.time} ${event.end_time ? '- ' + event.end_time : ''}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="material-icons" style="font-size: 18px; color: #666;">label</i>
            <span><strong>Type:</strong> ${markerTitle}</span>
          </div>
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <i class="material-icons" style="font-size: 18px; color: #666;">description</i>
            <span><strong>Description:</strong> ${event.description}</span>
          </div>
          ${event.location.address ? `
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <i class="material-icons" style="font-size: 18px; color: #666;">location_on</i>
              <span><strong>Address:</strong> ${event.location.address}</span>
            </div>
          ` : ''}
          ${event.duration_minutes ? `
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="material-icons" style="font-size: 18px; color: #666;">timer</i>
              <span><strong>Duration:</strong> ${event.duration_minutes} minutes</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    marker.bindPopup(popupContent);
    return marker;
  }

  toggleTimelineMap(): void {
    this.showTimelineMap = !this.showTimelineMap;
    
    if (this.showTimelineMap) {
      setTimeout(() => {
        this.initializeTimelineMapView();
      }, 100);
    } else {
      // Destroy map when hiding
      if (this.timelineMapView) {
        this.timelineMapView.remove();
        this.timelineMapView = null;
      }
    }
  }

  getTotalDistance(): number {
    if(this.attendanceData){
      const stop = this.attendanceData.stop_meter_reading || 0;
      const start = this.attendanceData.start_meter_reading || 0;
      const result = stop - start;
      return result < 0 ? 0 : parseFloat(result.toFixed(2));
    }else{
      return 0
    }
  }

  goToImage(image) {
    const dialogRef = this.dialogs.open(ImageModuleComponent, {
      panelClass: 'Image-modal',
      data: {
        'image': image,
        'type': 'base64'
      }
    });
    dialogRef.afterClosed().subscribe(result => {
    });
  }

  showList(){
    if(this.userListing==true){
      this.userListing=false
    }else{
      this.userListing=true
    }
  }

  selectUser(user: any) {
    this.selectedUserId = user.id;
    this.searchTerm = `${user.name} - ${user.employee_id}`;
    this.onUserChange()
  }

downloadPermissionsReport() {
  const userIdToUse = this.selectedUserId || this.payload.user_id;

  // Convert selectedDate (e.g. "2025-09-15") to "15_09_2025"
  let date = new Date(this.selectedDate);
  let day = String(date.getDate()).padStart(2, '0');
  let month = String(date.getMonth() + 1).padStart(2, '0');
  let year = date.getFullYear();

  let formattedDate = `${day}_${month}_${year}`;

  let filename = formattedDate + '_' + userIdToUse;
  console.log(filename);

  window.open(this.downurl + 'background_location/device_health_' + filename + '.csv');
}

toggleFullScreen(isFullScreen: boolean): void {
  if (isFullScreen) {
    // Add full-screen CSS class
    this.renderer.addClass(this.document.body, 'fullscreen-map');

    // Request REAL fullscreen (Chrome F11 style)
    const elem = this.document.documentElement; // <html>

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    } else if ((elem as any).msRequestFullscreen) {
      (elem as any).msRequestFullscreen();
    }

  } else {
    // Remove CSS class
    this.renderer.removeClass(this.document.body, 'fullscreen-map');

    // Exit REAL fullscreen
    if (this.document.exitFullscreen) {
      this.document.exitFullscreen();
    } else if ((this.document as any).webkitExitFullscreen) {
      (this.document as any).webkitExitFullscreen();
    } else if ((this.document as any).msExitFullscreen) {
      (this.document as any).msExitFullscreen();
    }
  }
}



  

}
