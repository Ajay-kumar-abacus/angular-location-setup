import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Renderer2, Inject } from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { MatDialog } from '@angular/material';
import { Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as moment from 'moment';
import { DatabaseService } from 'src/_services/DatabaseService';
import { ImageModuleComponent } from 'src/app/image-module/image-module.component';
// import { OlaMaps } from 'olamaps-web-sdk'
import { DOCUMENT } from '@angular/common';
declare var OlaMaps: any;

// Declare Leaflet for map functionality
declare const L: any;
declare var zingchart: any;

// TrackPlayer is loaded globally via index.html script tag

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


// Live Location Response Interface
interface LiveLocationUser {
  id: number;
  user_id: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  status: string;
  activity_type: string;
  is_moving: number;
  battery_level: number;
  is_charging: number;
  app_in_foreground: number;
  created_at: string;
  updated_at: string;
  name: string;
  contact_01: number;
  minutes_ago: number;
  is_stale: boolean;
  is_online: boolean;
}

@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss'],
  animations: [
    trigger('slideDown', [
      transition(':enter', [
        style({ height: 0, opacity: 0, overflow: 'hidden' }),
        animate('200ms ease-out', style({ height: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ height: '*', opacity: 1, overflow: 'hidden' }),
        animate('200ms ease-in', style({ height: 0, opacity: 0 }))
      ])
    ])
  ]
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

  // Permission Report Data (from BackgroundLocationProcess/getPermissionReport)
  permissionReportData: any = null;
  permissionReportLoading: boolean = false;

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
  filteredLiveUsersData: any[] = [];
  liveUsersMarkers: any[] = [];
  liveUsersUpdateInterval: any;
  showUsersList: boolean = true;
  selectedLiveUsers: Set<string> = new Set();
  liveUserSearchTerm: string = '';

  timelineEvents: any[] = [];
  timelineData: any = {};

  // Add these at the top of your class with other properties
  private liveTrackingInterval: any;
  private currentLiveMarker: any;
  private previousPosition: [number, number] | null = null;
  private isAnimating: boolean = false;

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
  playbackDelay: number = 1000;
  showSpeedControl: boolean = false;
  playbackMarker: any;
  playbackInterval: any;
  roadRouteCoordinates: [number, number][] = []; // Store road route coordinates
  currentPlaybackIndex: number = 0; // Track current position in route

  // Enhanced Playback Properties
  currentPlaybackDistance: string = '0';
  playbackStartTime: string = '';
  playbackEndTime: string = '';
  currentPlaybackAddress: string = '';
  followMarker: boolean = true;
  playbackTrackLine: any; // Track line that follows the marker
  coveredTrackLine: any; // Already covered path (green)
  remainingTrackLine: any; // Remaining track to cover (grey)
  showHoldPointInfo: boolean = false; // Toggle for hold point info tooltip

  batteryData: number[] = [];
  batteryTimeLabels: string[] = [];
  batteryChart: any;

  payload: any = {};
  userId: string = '';
  playbackDateTime: any;
  total_distance: any;
  debugFlag: any = false;
  summarizeData: any;
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

  // KM Calendar Properties
  selectedKmMonth: number = new Date().getMonth() + 1;
  selectedKmYear: number = new Date().getFullYear();
  availableYears: number[] = [];
  kmCalendarData: any = null;
  calendarWeeks: any[][] = [];
  isLoadingKmCalendar: boolean = false;
  selectedKmDay: any = null;

  // Check-in Timeline Tab Properties
  checkinTimelineTab: string = 'timeline';
  googleMapsEmbedUrl: SafeResourceUrl | null = null;

  // API Hold Points and Permission Locations (from BackgroundLocationProcess/getHoldPointsAndPermissionLocations)
  apiHoldPointsData: any = null;
  apiHoldPoints: any[] = [];
  apiPermissionChangeLocations: any[] = [];
  apiHoldPointMarkers: any[] = [];
  apiPermissionMarkers: any[] = [];

  // Toggle controls for map markers visibility
  showCheckinMarkers: boolean = true;
  showHoldPointMarkers: boolean = false;
  showPermissionMarkers: boolean = false;
  showLegendDropdown: boolean = false;

// showGpsTooltip: boolean = false;
  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    public service: DatabaseService,
    public dialogs: MatDialog,
    private renderer: Renderer2,
    private sanitizer: DomSanitizer,
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
    this.initializeKmCalendar();
  }

  ngOnDestroy(): void {
    // Stop custom playback
    this.pausePlayback();

    // Remove TrackPlayer
    if (this.trackPlayer) {
      this.trackPlayer.remove();
      this.trackPlayer = null;
    }

    if (this.customPlaybackMarker && this.map) {
      this.map.removeLayer(this.customPlaybackMarker);
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


  // Open Google Maps with route from previous point to current point
  openGoogleMapsRoute(currentIndex: number): void {
    if (!this.timelineCheckin || currentIndex < 0) return;

    const currentEvent = this.timelineCheckin[currentIndex];
    if (!currentEvent.location.lat || !currentEvent.location.lng) return;

    const destLat = currentEvent.location.lat;
    const destLng = currentEvent.location.lng;

    // Find the previous event with location
    let originLat: number | null = null;
    let originLng: number | null = null;

    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevEvent = this.timelineCheckin[i];
      if (prevEvent.location.lat && prevEvent.location.lng) {
        originLat = prevEvent.location.lat;
        originLng = prevEvent.location.lng;
        break;
      }
    }

    let googleMapsUrl: string;
    if (originLat !== null && originLng !== null) {
      // Route from previous point to current point
      googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
    } else {
      // If no previous point, just open the location
      googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${destLat},${destLng}`;
    }

    window.open(googleMapsUrl, '_blank');
  }

  // Open Google Maps with full route (all points from timeline)
  openFullRouteOnGoogleMaps(): void {
    if (!this.timelineCheckin || this.timelineCheckin.length === 0) return;

    // Collect all locations with valid lat/lng
    const locations = this.timelineCheckin
      .filter(event => event.location.lat && event.location.lng)
      .map(event => ({
        lat: event.location.lat,
        lng: event.location.lng
      }));

    if (locations.length === 0) return;

    if (locations.length === 1) {
      // Only one point, just open location
      const loc = locations[0];
      window.open(`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`, '_blank');
      return;
    }

    // Google Maps allows up to 10 waypoints (12 total points: 1 origin + 10 waypoints + 1 destination)
    const maxPointsPerRoute = 12;

    if (locations.length <= maxPointsPerRoute) {
      // All points fit in one route
      this.openGoogleMapsRouteFromLocations(locations);
    } else {
      // Need to split into multiple routes
      const totalParts = Math.ceil(locations.length / (maxPointsPerRoute - 1)); // -1 for overlap
      const confirmed = confirm(
        `This route has ${locations.length} locations.\n\n` +
        `Google Maps only supports 12 points per route, so it will be split into ${totalParts} parts.\n\n` +
        `Click OK to open ${totalParts} tabs with the route parts.`
      );

      if (confirmed) {
        this.openMultipleGoogleMapsRoutes(locations, maxPointsPerRoute);
      }
    }
  }

  // Helper: Open a single Google Maps route with array of locations
  private openGoogleMapsRouteFromLocations(locations: {lat: number, lng: number}[]): void {
    const origin = locations[0];
    const destination = locations[locations.length - 1];
    const waypoints = locations.slice(1, -1);

    let googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;

    if (waypoints.length > 0) {
      const waypointsStr = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
      googleMapsUrl += `&waypoints=${waypointsStr}`;
    }

    window.open(googleMapsUrl, '_blank');
  }

  // Helper: Split locations into multiple routes and open each
  private openMultipleGoogleMapsRoutes(locations: {lat: number, lng: number}[], maxPointsPerRoute: number): void {
    const routes: {lat: number, lng: number}[][] = [];
    let startIndex = 0;

    while (startIndex < locations.length - 1) {
      // Each route: take maxPointsPerRoute points, but overlap by 1 with next route
      const endIndex = Math.min(startIndex + maxPointsPerRoute, locations.length);
      routes.push(locations.slice(startIndex, endIndex));

      // Start next route from the last point of current route (for continuity)
      startIndex = endIndex - 1;
    }

    // Open each route with a small delay to avoid popup blockers
    routes.forEach((route, index) => {
      setTimeout(() => {
        this.openGoogleMapsRouteFromLocations(route);
      }, index * 500); // 500ms delay between each tab
    });
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
      this.loadMonthlyKmData();
      this.UserInformationDetail();
      this.loadTrackingAccuracy();
      this.loadLocationTimeLine();
      this.loadGetDayActivityTimeline()
       this.loadGetPermissionReport()
       this.loadHoldPointsAndPermissionLocations()
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
    // Check if user is selected for tabs other than liveusers
    if (tab !== 'liveusers' && !this.selectedUserId && !this.payload.user_id) {
      this.showSelectUserAlert = true;
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

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
        // Auto-enable snap-to-road for backdates and load snapped route
        // if (!this.isToday()) {
        //   this.snapToRoad = true;
        //   this.initializePlaybackWithSnapToRoad();
        // } else {
          this.initializePlaybackMap();
        // }
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
      // this.loadGetPermissionReport();
      break;
      case 'permissionreport':
        this.loadPermissionReportData();
        break;
    }
  }

  closeSelectUserAlert(): void {
    this.showSelectUserAlert = false;
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

      // Add markers based on toggle states
      if (this.showCheckinMarkers) {
        this.addLocationMarkers();
      }
      if (this.showHoldPointMarkers) {
        this.addApiHoldPointMarkers();
      }
      if (this.showPermissionMarkers) {
        this.addApiPermissionMarkers();
      }

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

      // Add markers based on toggle states
      if (this.showCheckinMarkers) {
        this.addLocationMarkers();
      }
      if (this.showHoldPointMarkers) {
        this.addApiHoldPointMarkers();
      }
      if (this.showPermissionMarkers) {
        this.addApiPermissionMarkers();
      }

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
      iconUrl: 'assets/location/person.png',
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
        layer.options.icon.options.iconUrl === 'assets/location/person.png') {
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

      // Add markers based on toggle states
      if (this.showCheckinMarkers) {
        this.addLocationMarkers();
      }
      if (this.showHoldPointMarkers) {
        this.addApiHoldPointMarkers();
      }
      if (this.showPermissionMarkers) {
        this.addApiPermissionMarkers();
      }

      // Initialize custom playback system
      this.initializeCustomPlayback();

      // Fit map to show all points
      this.fitMapToBounds();

      this.isMapLoading = false;
    }, 500);
  }

  // Initialize playback with snap-to-road data (for backdates)
  private initializePlaybackWithSnapToRoad(): void {
    this.isMapLoading = true;
    this.locationMarkers = [];

    const userIdToUse = this.selectedUserId || this.payload.user_id;

    let header = {
      'date': this.selectedDate,
      'user_id': userIdToUse
    };

    this.service.post_rqst(header, "BackgroundLocationProcess/getDailyReportSnapped")
      .subscribe((result => {
        this.locationMarkers = result.route.points;
        this.total_distance = result.route.distance_km;

        if (this.locationMarkers.length > 0) {
          // Initialize playback map after getting snapped route data
          this.initializePlaybackMap();
        } else {
          this.isMapLoading = false;
        }
      }));
  }

  // ============================================
  // TRACKPLAYER PLAYBACK SYSTEM
  // ============================================

  private customPlaybackMarker: any = null;
  private customPlaybackTimeout: any = null;
  private animationFrameId: any = null;
  private trackPlayer: any = null;

  private initializeCustomPlayback(): void {
    console.log('initializeCustomPlayback called, map:', !!this.map, 'markers:', this.locationMarkers.length);

    // Remove existing TrackPlayer if exists
    if (this.trackPlayer) {
      this.trackPlayer.remove();
      this.trackPlayer = null;
    }

    // Remove existing marker if exists
    if (this.customPlaybackMarker && this.map) {
      this.map.removeLayer(this.customPlaybackMarker);
    }

    // Remove existing track lines
    if (this.remainingTrackLine && this.map) {
      this.map.removeLayer(this.remainingTrackLine);
    }
    if (this.coveredTrackLine && this.map) {
      this.map.removeLayer(this.coveredTrackLine);
    }

    if (!this.locationMarkers.length) {
      console.warn('No location markers available for playback');
      return;
    }

    // Prepare track data for TrackPlayer (format matches tracker component)
    const trackData = this.locationMarkers.map((marker, index) => {
      const ts = marker.timestamp || marker.date_created;
      const distance = marker.total_distance_from_start || this.calculateCoveredDistance(index);
      return {
        lng: marker.lng,
        lat: marker.lat,
        dateTime: moment(Number(ts) * 1000).format('DD MMM YYYY, hh:mm a') + ' (' + distance + ' KM)'
      };
    });

    // Create person icon for TrackPlayer marker (use L.icon for rotation support)
    const personIcon = L.icon({
      iconUrl: './assets/location/person.png',
      iconSize: [50, 50],
      iconAnchor: [25, 25]
    });

    // Initialize TrackPlayer (using global L.TrackPlayer)
    this.trackPlayer = new L.TrackPlayer(trackData, {
      markerIcon: personIcon,
      speed: this.getTrackPlayerSpeed(),
      markerRotation: true,
      panTo: this.followMarker
    }).addTo(this.map);

    // Store reference to the marker
    this.customPlaybackMarker = this.trackPlayer.getMarker ? this.trackPlayer.getMarker() : null;

    // Listen to TrackPlayer events
    this.trackPlayer.on('progress', (progress: number, data: any, index: number) => {
      this.onTrackPlayerProgress(progress, data, index);
    });

    this.trackPlayer.on('start', () => {
      this.playbackStatus = 'playing';
    });

    this.trackPlayer.on('pause', () => {
      this.playbackStatus = 'paused';
    });

    this.trackPlayer.on('finished', () => {
      this.playbackStatus = 'stopped';
      this.playbackProgress = 100;
    });

    // Add start marker (green circle)
    this.addStartEndMarkers();

    // Initialize state
    this.currentPlaybackIndex = 0;
    this.playbackProgress = 0;
    this.playbackStatus = 'stopped';

    // Initialize playback times
    this.initPlaybackTimes();

    // Update initial info
    this.updatePlaybackInfo(0);
  }

  // Get TrackPlayer speed based on playbackDelay
  private getTrackPlayerSpeed(): number {
    // playbackDelay: 2000 = 0.5x, 1000 = 1x, 500 = 2x, 200 = 5x
    // TrackPlayer speed: higher = faster, default is 1000 like tracker component
    switch (this.playbackDelay) {
      case 2000: return 500;   // 0.5x speed
      case 1000: return 1000;  // 1x speed (default like tracker)
      case 500: return 2000;   // 2x speed
      case 200: return 5000;   // 5x speed
      default: return 1000;
    }
  }

  // Handle TrackPlayer progress events
  // progress: 0-1 value, data: {lng, lat, dateTime}, index: current point index
  private onTrackPlayerProgress(progress: number, data: any, index: number): void {
    if (!this.locationMarkers.length) return;

    // Progress is 0-1, convert to percentage
    const progressPercent = progress * 100;

    // Update progress percentage for slider
    this.playbackProgress = progressPercent;

    // Update playback info when index changes
    if (index !== this.currentPlaybackIndex && index >= 0 && index < this.locationMarkers.length) {
      this.currentPlaybackIndex = index;
      this.updatePlaybackInfo(index);
    }

    // Extract and display dateTime from data if available
    if (data && data.dateTime) {
      // dateTime is already formatted in trackData preparation
      const dateTimeParts = data.dateTime.split(' (');
      if (dateTimeParts.length > 0) {
        this.playbackDateTime = dateTimeParts[0];
      }
    }
  }

  // Add start and end markers
  private addStartEndMarkers(): void {
    if (!this.map || !this.locationMarkers.length) return;

    // Add start marker (using start_point.png)
    try {
      const startIcon = L.icon({
        iconUrl: './assets/location/start_point.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });
      L.marker([this.locationMarkers[0].lat, this.locationMarkers[0].lng], { icon: startIcon })
        .addTo(this.map)
        .bindPopup('<b>Start Point</b>');
    } catch (e) {
      console.warn('Could not add start marker:', e);
    }

    // Add end marker (using end_point.png)
    try {
      const lastIndex = this.locationMarkers.length - 1;
      const endIcon = L.icon({
        iconUrl: './assets/location/end_point.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });
      L.marker([this.locationMarkers[lastIndex].lat, this.locationMarkers[lastIndex].lng], { icon: endIcon })
        .addTo(this.map)
        .bindPopup('<b>End Point</b>');
    } catch (e) {
      console.warn('Could not add end marker:', e);
    }
  }

  // Draw full track line from start (grey remaining track)
  private drawFullTrackLine(): void {
    if (!this.map) {
      console.warn('Map not initialized for drawFullTrackLine');
      return;
    }

    if (!this.locationMarkers || this.locationMarkers.length < 2) {
      console.warn('Not enough location markers for track line:', this.locationMarkers.length);
      return;
    }

    console.log('Drawing full track line with', this.locationMarkers.length, 'points');

    const allCoords = this.locationMarkers.map(m => [m.lat, m.lng]);

    // Create the full track line (blue - remaining to cover)
    this.remainingTrackLine = L.polyline(allCoords, {
      color: '#3b82f6', // Blue color for remaining track
      weight: 5,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    console.log('Track line added to map');

    // Add start marker (using start_point.png)
    try {
      const startIcon = L.icon({
        iconUrl: './assets/location/start_point.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });
      L.marker([this.locationMarkers[0].lat, this.locationMarkers[0].lng], { icon: startIcon })
        .addTo(this.map)
        .bindPopup('<b>Start Point</b>');
    } catch (e) {
      console.warn('Could not add start marker:', e);
    }

    // Add end marker (using end_point.png)
    try {
      const lastIndex = this.locationMarkers.length - 1;
      const endIcon = L.icon({
        iconUrl: './assets/location/end_point.png',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
      });
      L.marker([this.locationMarkers[lastIndex].lat, this.locationMarkers[lastIndex].lng], { icon: endIcon })
        .addTo(this.map)
        .bindPopup('<b>End Point</b>');
    } catch (e) {
      console.warn('Could not add end marker:', e);
    }
  }

  private convertToIST(timestamp: string | number): string {
    const ts = Number(timestamp);
    if (isNaN(ts)) return '';
    return moment.unix(ts).utcOffset("+05:30").format("YYYY-MM-DD HH:mm:ss");
  }

  startPlayback(): void {
    if (!this.trackPlayer || !this.locationMarkers.length) {
      console.warn('TrackPlayer not initialized');
      return;
    }

    // If already finished, restart from beginning
    if (this.playbackProgress >= 100) {
      this.trackPlayer.setProgress(0);
      this.currentPlaybackIndex = 0;
      this.playbackProgress = 0;
    }

    this.playbackStatus = 'playing';
    this.trackPlayer.start();
  }

  pausePlayback(): void {
    this.playbackStatus = 'paused';

    // Pause TrackPlayer
    if (this.trackPlayer) {
      this.trackPlayer.pause();
    }

    // Clear any pending timeouts/animations (fallback)
    if (this.customPlaybackTimeout) {
      clearTimeout(this.customPlaybackTimeout);
      this.customPlaybackTimeout = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // Legacy method kept for compatibility - not used with TrackPlayer
  private moveToNextPoint(): void {
    // This method is no longer used - TrackPlayer handles animation
    if (this.playbackStatus !== 'playing') return;
    if (this.currentPlaybackIndex >= this.locationMarkers.length - 1) {
      this.playbackStatus = 'stopped';
      this.playbackProgress = 100;
      return;
    }
  }

  // Legacy method kept for compatibility - not used with TrackPlayer
  private animateMarkerToPoint(
    from: [number, number],
    to: [number, number],
    onComplete: () => void
  ): void {
    // This method is no longer used - TrackPlayer handles animation
    onComplete();
  }

  // Update progress from slider
  updateProgress(event: any): void {
    const wasPlaying = this.playbackStatus === 'playing';
    if (wasPlaying) {
      this.pausePlayback();
    }

    this.playbackProgress = parseFloat(event.target.value);

    // Update TrackPlayer progress
    if (this.trackPlayer) {
      this.trackPlayer.setProgress(this.playbackProgress / 100);
    }

    const markerIndex = Math.floor((this.playbackProgress / 100) * (this.locationMarkers.length - 1));

    if (markerIndex < this.locationMarkers.length) {
      this.currentPlaybackIndex = markerIndex;
      const marker = this.locationMarkers[markerIndex];

      // Update datetime
      const ts = marker.timestamp || marker.date_created;
      this.playbackDateTime = this.convertToIST(ts);
      this.updatePlaybackInfo(markerIndex);
    }

    if (wasPlaying) {
      this.startPlayback();
    }
  }

  // Stop and reset playback
  stopPlayback(): void {
    this.pausePlayback();
    this.currentPlaybackIndex = 0;
    this.playbackProgress = 0;
    this.playbackStatus = 'stopped';

    // Reset TrackPlayer to start
    if (this.trackPlayer) {
      this.trackPlayer.setProgress(0);
    }

    // Pan to start point
    if (this.locationMarkers.length > 0) {
      const startPoint = this.locationMarkers[0];
      this.map.panTo([startPoint.lat, startPoint.lng]);
    }

    this.updatePlaybackInfo(0);
  }

  // Format label for speed slider
  formatLabel(value: number): string {
    return `${value}`;
  }

  // Enhanced Playback Methods

  // Haversine formula to calculate distance between two lat/lng points in KM
  private calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Calculate total distance covered up to a given index
  private calculateCoveredDistance(index: number): string {
    if (index < 1 || !this.locationMarkers.length) return '0';

    let totalDistance = 0;
    for (let i = 1; i <= index && i < this.locationMarkers.length; i++) {
      const prev = this.locationMarkers[i - 1];
      const curr = this.locationMarkers[i];
      totalDistance += this.calculateHaversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    }
    return totalDistance.toFixed(2);
  }

  // Calculate total route distance
  calculateTotalRouteDistance(): string {
    if (this.locationMarkers.length < 2) return '0';
    return this.calculateCoveredDistance(this.locationMarkers.length - 1);
  }

  setPlaybackSpeed(speedValue: number): void {
    // speedValue controls animation duration (lower = faster)
    this.playbackDelay = speedValue;

    // Update TrackPlayer speed
    if (this.trackPlayer) {
      this.trackPlayer.setSpeed(this.getTrackPlayerSpeed());
    }
  }

  skipPlayback(points: number): void {
    if (!this.locationMarkers.length) return;

    const wasPlaying = this.playbackStatus === 'playing';
    if (wasPlaying) {
      this.pausePlayback();
    }

    let newIndex = this.currentPlaybackIndex + points;
    newIndex = Math.max(0, Math.min(newIndex, this.locationMarkers.length - 1));

    this.currentPlaybackIndex = newIndex;
    this.playbackProgress = (newIndex / (this.locationMarkers.length - 1)) * 100;

    // Update TrackPlayer progress
    if (this.trackPlayer) {
      this.trackPlayer.setProgress(this.playbackProgress / 100);
    }

    // Pan to new position
    if (this.locationMarkers[newIndex]) {
      const marker = this.locationMarkers[newIndex];
      this.map.panTo([marker.lat, marker.lng]);
    }

    this.updatePlaybackInfo(newIndex);

    if (wasPlaying) {
      this.startPlayback();
    }
  }

  toggleFollowMarker(): void {
    this.followMarker = !this.followMarker;

    // Update TrackPlayer panTo option
    if (this.trackPlayer) {
      this.trackPlayer.options.panTo = this.followMarker;
    }
  }

  private updatePlaybackInfo(index: number): void {
    if (index < this.locationMarkers.length) {
      const marker = this.locationMarkers[index];
      this.currentPlaybackIndex = index;

      // Calculate distance from lat/lng using Haversine formula
      this.currentPlaybackDistance = this.calculateCoveredDistance(index);

      // Update time
      const ts = marker.timestamp || marker.date_created;
      this.playbackDateTime = this.convertToIST(ts);

      // Update address if available
      this.currentPlaybackAddress = marker.address || '';

      // Update covered track line
      this.updateCoveredTrack(index);
    }
  }

  private updateCoveredTrack(index: number): void {
    if (!this.map || index < 1) return;

    // Get coordinates up to current index (covered portion - green)
    const coveredCoords = this.locationMarkers.slice(0, index + 1).map(m => [m.lat, m.lng]);

    // Remove existing covered track
    if (this.coveredTrackLine) {
      this.map.removeLayer(this.coveredTrackLine);
    }

    // Draw covered track with green color (on top of grey remaining track)
    this.coveredTrackLine = L.polyline(coveredCoords, {
      color: '#10b981', // Green for covered path
      weight: 6,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    // Bring covered track to front
    this.coveredTrackLine.bringToFront();

    // Keep playback marker on top
    if (this.customPlaybackMarker) {
      this.customPlaybackMarker.setZIndexOffset(1000);
    }
  }

  private initPlaybackTimes(): void {
    if (this.locationMarkers.length > 0) {
      const firstMarker = this.locationMarkers[0];
      const lastMarker = this.locationMarkers[this.locationMarkers.length - 1];

      const startTs = firstMarker.timestamp || firstMarker.date_created;
      const endTs = lastMarker.timestamp || lastMarker.date_created;

      this.playbackStartTime = moment.unix(Number(startTs)).format('HH:mm');
      this.playbackEndTime = moment.unix(Number(endTs)).format('HH:mm');
    }
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
    if(this.activeTab=="live"){
      this.addEndPointLocationMarkerLive();
    }else{
  this.addEndPointLocationMarker();
    }

    
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
   private addEndPointLocationMarkerLive(): void {
    const lastIndex = this.locationMarkers.length - 1;
    console.log("line 678")
    const icon = L.icon({
      iconUrl: 'assets/location/person.png', // replace with your image path
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
    <div style="min-width: 200px; max-width: 280px; font-family: Arial, sans-serif; font-size: 12px;">
      <!-- Header Section -->
      <div style="background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 8px 10px; border-radius: 6px 6px 0 0;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <i class="material-icons" style="font-size: 16px;">where_to_vote</i>
          <h3 style="margin: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${checkin.dr_name || 'Check-in Location'}</h3>
        </div>
      </div>

      <!-- Main Content -->
      <div style="display: grid; gap: 6px; padding: 8px;">

        <!-- Contact & Type Info -->
        ${(checkin.mobile || checkin.dr_type_name) ? `
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${checkin.mobile ? `<span style="background: #e8f5e9; padding: 2px 6px; border-radius: 4px; font-size: 11px;"><i class="material-icons" style="font-size: 12px; vertical-align: middle; color: #4CAF50;">phone</i> ${checkin.mobile}</span>` : ''}
          ${checkin.dr_type_name ? `<span style="background: #fff3e0; padding: 2px 6px; border-radius: 4px; font-size: 11px;"><i class="material-icons" style="font-size: 12px; vertical-align: middle; color: #FF9800;">category</i> ${checkin.dr_type_name}</span>` : ''}
        </div>
        ` : ''}

        <!-- Visit Timing -->
        <div style="background: #f5f5f5; padding: 6px; border-radius: 4px;">
          <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 3px;">
            <i class="material-icons" style="font-size: 14px; color: #4CAF50;">login</i>
            <span><strong>In:</strong> ${moment(checkin.visit_start).format('hh:mm A')}</span>
          </div>
          ${checkin.visit_end ? `
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 3px;">
              <i class="material-icons" style="font-size: 14px; color: #f44336;">logout</i>
              <span><strong>Out:</strong> ${moment(checkin.visit_end).format('hh:mm A')}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <i class="material-icons" style="font-size: 14px; color: #2196F3;">schedule</i>
              <span><strong>Duration:</strong> ${this.calculateDuration(checkin.visit_start, checkin.visit_end)}</span>
            </div>
          ` : `<span style="color: #f57c00; font-size: 11px;"><i class="material-icons" style="font-size: 12px; vertical-align: middle;">info</i> Still checked in</span>`}
        </div>

        ${timelineData && timelineData.distance_from_previous ? `
          <div style="background: #e3f2fd; padding: 6px; border-radius: 4px;">
            <div style="display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px;">
              <span><i class="material-icons" style="font-size: 12px; vertical-align: middle; color: #1976D2;">directions_car</i> ${timelineData.distance_from_previous.formatted}</span>
              ${timelineData.distance_from_previous.duration_formatted ? `<span><i class="material-icons" style="font-size: 12px; vertical-align: middle; color: #1976D2;">timer</i> ${timelineData.distance_from_previous.duration_formatted}</span>` : ''}
              ${timelineData.distance_from_previous.speed_kmh ? `<span><i class="material-icons" style="font-size: 12px; vertical-align: middle; color: #1976D2;">speed</i> ${timelineData.distance_from_previous.speed_kmh.toFixed(0)} km/h</span>` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Address -->
        ${checkin.start_address ? `
          <div style="font-size: 11px; color: #666; line-height: 1.3;">
            <i class="material-icons" style="font-size: 12px; vertical-align: middle; color: #FF9800;">location_on</i>
            ${checkin.start_address.length > 60 ? checkin.start_address.substring(0, 60) + '...' : checkin.start_address}
          </div>
        ` : ''}

        <!-- Activities -->
        ${(checkin.order_flag || checkin.followup_flag || checkin.doc_flag || checkin.popgift_flag) ? `
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${checkin.order_flag ? '<span style="background: #4CAF50; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px;">Order</span>' : ''}
            ${checkin.followup_flag ? '<span style="background: #2196F3; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px;">Follow-up</span>' : ''}
            ${checkin.doc_flag ? '<span style="background: #FF9800; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px;">Doc</span>' : ''}
            ${checkin.popgift_flag ? '<span style="background: #E91E63; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px;">Gift</span>' : ''}
          </div>
        ` : ''}

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

// Helper function to calculate duration from time strings like "10:58:43"
public calculateFaceTime(startTime: string, endTime: string): string {
  if (!startTime || !endTime) {
    return '--';
  }

  // Parse time strings (HH:mm:ss format)
  const startParts = startTime.split(':').map(Number);
  const endParts = endTime.split(':').map(Number);

  if (startParts.length < 2 || endParts.length < 2) {
    return '--';
  }

  // Convert to seconds
  const startSeconds = (startParts[0] * 3600) + (startParts[1] * 60) + (startParts[2] || 0);
  const endSeconds = (endParts[0] * 3600) + (endParts[1] * 60) + (endParts[2] || 0);

  // Calculate difference
  let diffSeconds = endSeconds - startSeconds;

  // Handle case where end time might be next day (though unlikely for face time)
  if (diffSeconds < 0) {
    diffSeconds += 24 * 3600;
  }

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

// Helper function to format time string "10:58:43" to "10:58 AM" format
public formatTimeToAmPm(timeString: string): string {
  if (!timeString) {
    return '--';
  }

  const parts = timeString.split(':').map(Number);
  if (parts.length < 2) {
    return timeString;
  }

  let hours = parts[0];
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12

  return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
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

  // Clean up map and playback resources
  private destroyExistingMap(): void {
    // Stop custom playback
    this.pausePlayback();

    // Remove TrackPlayer
    if (this.trackPlayer) {
      this.trackPlayer.remove();
      this.trackPlayer = null;
    }

    // Remove custom playback marker
    if (this.customPlaybackMarker && this.map) {
      this.map.removeLayer(this.customPlaybackMarker);
      this.customPlaybackMarker = null;
    }

    // Clear API hold point and permission markers
    this.clearApiHoldPointMarkers();
    this.clearApiPermissionMarkers();

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
    this.loadMonthlyKmData();
    this.UserInformationDetail();
    this.loadGetDayActivityTimeline()
    this.loadGetPermissionReport()
    this.loadHoldPointsAndPermissionLocations()

    // Reset playback state
    this.roadRouteCoordinates = [];
    this.currentPlaybackIndex = 0;
  }

  navigateDate(direction: number): void {
    const currentDate = moment(this.selectedDate);
    const newDate = currentDate.add(direction, 'days');

    // Don't go beyond today
    if (newDate.isAfter(moment(), 'day')) {
      return;
    }

    this.selectedDate = newDate.format('YYYY-MM-DD');
    this.onDateChange();
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
    // Clear custom playback
    this.pausePlayback();
  }

  // Reset playback to beginning
  resetPlayback(): void {
    this.stopPlayback();
  }

  // Jump to specific location marker
  jumpToMarker(markerIndex: number): void {
    if (markerIndex < 0 || markerIndex >= this.locationMarkers.length) return;

    const targetMarker = this.locationMarkers[markerIndex];

    // Calculate approximate progress based on marker position
    this.currentPlaybackIndex = markerIndex;
    this.playbackProgress = (markerIndex / (this.locationMarkers.length - 1)) * 100;

    // Move custom playback marker
    if (this.customPlaybackMarker) {
      this.customPlaybackMarker.setLatLng([targetMarker.lat, targetMarker.lng]);
    }

    // Update datetime
    const ts = targetMarker.timestamp || targetMarker.date_created;
    this.playbackDateTime = this.convertToIST(ts);

    // Pan map to location
    this.map.panTo([targetMarker.lat, targetMarker.lng], {
      animate: true,
      duration: 1
    });

    this.updatePlaybackInfo(markerIndex);
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

    this.service.post_rqst(header, "BackgroundLocationProcess/getLiveLocations")
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

// ============================================
// HOLD POINTS AND PERMISSION LOCATIONS API
// ============================================

loadHoldPointsAndPermissionLocations(): void {
  // Clear existing markers before loading new data
  this.clearApiHoldPointMarkers();
  this.clearApiPermissionMarkers();

  // Reset data
  this.apiHoldPointsData = null;
  this.apiHoldPoints = [];
  this.apiPermissionChangeLocations = [];

  const userIdToUse = this.selectedUserId || this.payload.user_id;
  let header = {
    'date': this.selectedDate,
    'user_id': userIdToUse
  };

  this.service.post_rqst(header, "BackgroundLocationProcess/getHoldPointsAndPermissionLocations")
    .subscribe(
      (result) => {
        this.apiHoldPointsData = result || {};
        this.apiHoldPoints = result['hold_points'] || [];
        this.apiPermissionChangeLocations = result['permission_change_locations'] || [];
        console.log('Hold Points and Permission Locations:', this.apiHoldPointsData);
      },
      (error) => {
        console.error('Error loading hold points and permission locations:', error);
      }
    );
}

// Get hold type color based on duration
getHoldTypeColor(holdType: string): string {
  const colorMap: any = {
    'brief_stop': '#64748b',      // Gray - less than 3 min
    'short_stop': '#3b82f6',      // Blue - 3-10 min
    'medium_stop': '#f59e0b',     // Orange - 10-30 min
    'long_stop': '#ef4444'        // Red - more than 30 min
  };
  return colorMap[holdType] || '#64748b';
}

// Get hold type label
getHoldTypeLabel(holdType: string): string {
  const labelMap: any = {
    'brief_stop': 'Brief Stop',
    'short_stop': 'Short Stop',
    'medium_stop': 'Medium Stop',
    'long_stop': 'Long Stop'
  };
  return labelMap[holdType] || 'Stop';
}

// Get permission icon based on permission type
getPermissionChangeIcon(permissionType: string): string {
  const iconMap: any = {
    'battery_optimized': 'battery_std',
    'battery_optimization': 'battery_std',
    'location': 'location_on',
    'gps': 'gps_fixed',
    'internet': 'wifi',
    'network': 'signal_cellular_alt',
    'background_location': 'my_location'
  };
  return iconMap[permissionType] || 'settings';
}

// Get permission action color
getPermissionActionColor(action: string): string {
  return action === 'enabled' ? '#10b981' : '#ef4444';
}

// Add API hold point markers to map
addApiHoldPointMarkers(): void {
  // Clear existing markers
  this.clearApiHoldPointMarkers();

  if (!this.apiHoldPoints || this.apiHoldPoints.length === 0) return;

  this.apiHoldPoints.forEach((holdPoint, index) => {
    const holdColor = this.getHoldTypeColor(holdPoint.hold_type);

    const icon = L.divIcon({
      className: 'api-hold-point-marker',
      html: `
        <div class="hold-marker-wrapper" style="position: relative; cursor: pointer;">
          <div style="
            background: linear-gradient(135deg, ${holdColor} 0%, ${this.darkenColor(holdColor, 20)} 100%);
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          ">
            <span style="color: white; font-weight: bold; font-size: 12px;">H${index + 1}</span>
          </div>
          <div style="
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            background: ${holdColor};
            color: white;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 9px;
            white-space: nowrap;
            font-weight: 600;
          ">${holdPoint.duration_formatted}</div>
        </div>
      `,
      iconSize: [32, 45],
      iconAnchor: [16, 22],
      popupAnchor: [0, -22]
    });

    const marker = L.marker([holdPoint.latitude, holdPoint.longitude], { icon })
      .addTo(this.map);

    marker.bindPopup(this.createApiHoldPointPopup(holdPoint, index));
    this.apiHoldPointMarkers.push(marker);
  });
}

// Create popup content for API hold point
createApiHoldPointPopup(holdPoint: any, index: number): string {
  const holdColor = this.getHoldTypeColor(holdPoint.hold_type);
  const holdLabel = this.getHoldTypeLabel(holdPoint.hold_type);

  return `
    <div style="min-width: 220px; font-family: 'Segoe UI', Arial, sans-serif; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, ${holdColor} 0%, ${this.darkenColor(holdColor, 20)} 100%); color: white; padding: 12px 14px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="
            width: 28px;
            height: 28px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 12px;
          ">H${index + 1}</div>
          <div>
            <div style="font-size: 14px; font-weight: 600;">${holdLabel}</div>
            <div style="font-size: 11px; opacity: 0.9;">${holdPoint.duration_formatted}</div>
          </div>
        </div>
      </div>
      <div style="padding: 12px; background: #f8fafc;">
        <div style="display: grid; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="material-icons" style="font-size: 16px; color: #64748b;">schedule</i>
            <span style="font-size: 13px;"><strong>Time:</strong> ${holdPoint.start_time_formatted} - ${holdPoint.end_time_formatted}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="material-icons" style="font-size: 16px; color: #64748b;">timer</i>
            <span style="font-size: 13px;"><strong>Duration:</strong> ${holdPoint.duration_formatted}</span>
          </div>
          <div style="
            background: ${holdColor}15;
            padding: 8px 10px;
            border-radius: 8px;
            border-left: 3px solid ${holdColor};
          ">
            <span style="font-size: 12px; color: ${holdColor}; font-weight: 600;">
              <i class="material-icons" style="font-size: 14px; vertical-align: middle;">info</i>
              ${holdLabel} (${holdPoint.duration_seconds}s)
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Add permission change markers to map
addApiPermissionMarkers(): void {
  // Clear existing markers
  this.clearApiPermissionMarkers();

  if (!this.apiPermissionChangeLocations || this.apiPermissionChangeLocations.length === 0) return;

  this.apiPermissionChangeLocations.forEach((permission, index) => {
    const actionColor = this.getPermissionActionColor(permission.action);
    const icon = this.getPermissionChangeIcon(permission.permission_type);

    const markerIcon = L.divIcon({
      className: 'permission-change-marker',
      html: `
        <div class="permission-marker-wrapper" style="position: relative; cursor: pointer;">
          <div style="
            background: linear-gradient(135deg, ${actionColor} 0%, ${this.darkenColor(actionColor, 20)} 100%);
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          ">
            <i class="material-icons" style="color: white; font-size: 16px;">${icon}</i>
          </div>
          <div style="
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            background: ${actionColor};
            color: white;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 8px;
            white-space: nowrap;
            font-weight: 600;
            text-transform: uppercase;
          ">${permission.action}</div>
        </div>
      `,
      iconSize: [32, 45],
      iconAnchor: [16, 22],
      popupAnchor: [0, -22]
    });

    const marker = L.marker([permission.latitude, permission.longitude], { icon: markerIcon })
      .addTo(this.map);

    marker.bindPopup(this.createPermissionChangePopup(permission, index));
    this.apiPermissionMarkers.push(marker);
  });
}

// Create popup content for permission change
createPermissionChangePopup(permission: any, index: number): string {
  const actionColor = this.getPermissionActionColor(permission.action);
  const icon = this.getPermissionChangeIcon(permission.permission_type);
  const permissionLabel = this.formatPermissionName(permission.permission_type);

  return `
    <div style="min-width: 220px; font-family: 'Segoe UI', Arial, sans-serif; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, ${actionColor} 0%, ${this.darkenColor(actionColor, 20)} 100%); color: white; padding: 12px 14px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="
            width: 28px;
            height: 28px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <i class="material-icons" style="font-size: 16px;">${icon}</i>
          </div>
          <div>
            <div style="font-size: 14px; font-weight: 600;">${permissionLabel}</div>
            <div style="font-size: 11px; opacity: 0.9; text-transform: capitalize;">${permission.action}</div>
          </div>
        </div>
      </div>
      <div style="padding: 12px; background: #f8fafc;">
        <div style="display: grid; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="material-icons" style="font-size: 16px; color: #64748b;">access_time</i>
            <span style="font-size: 13px;"><strong>Changed at:</strong> ${permission.changed_at_formatted}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="material-icons" style="font-size: 16px; color: #64748b;">timer</i>
            <span style="font-size: 13px;"><strong>Previous state:</strong> ${permission.duration_formatted}</span>
          </div>
          <div style="
            display: flex;
            align-items: center;
            gap: 8px;
            background: ${actionColor}15;
            padding: 8px 10px;
            border-radius: 8px;
            border-left: 3px solid ${actionColor};
          ">
            <i class="material-icons" style="font-size: 14px; color: ${permission.old_status ? '#10b981' : '#ef4444'};">
              ${permission.old_status ? 'check_circle' : 'cancel'}
            </i>
            <i class="material-icons" style="font-size: 14px; color: #64748b;">arrow_forward</i>
            <i class="material-icons" style="font-size: 14px; color: ${permission.new_status ? '#10b981' : '#ef4444'};">
              ${permission.new_status ? 'check_circle' : 'cancel'}
            </i>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Clear API hold point markers
clearApiHoldPointMarkers(): void {
  this.apiHoldPointMarkers.forEach(marker => {
    if (this.map) {
      this.map.removeLayer(marker);
    }
  });
  this.apiHoldPointMarkers = [];
}

// Clear API permission markers
clearApiPermissionMarkers(): void {
  this.apiPermissionMarkers.forEach(marker => {
    if (this.map) {
      this.map.removeLayer(marker);
    }
  });
  this.apiPermissionMarkers = [];
}

// Helper function to darken color
darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// Toggle marker visibility handlers
toggleCheckinMarkersVisibility(): void {
  if (this.showCheckinMarkers) {
    this.addLocationMarkers();
  } else {
    this.clearCheckinMarkers();
  }
}

toggleHoldPointMarkersVisibility(): void {
  if (this.showHoldPointMarkers) {
    this.addApiHoldPointMarkers();
  } else {
    this.clearApiHoldPointMarkers();
  }
}

togglePermissionMarkersVisibility(): void {
  if (this.showPermissionMarkers) {
    this.addApiPermissionMarkers();
  } else {
    this.clearApiPermissionMarkers();
  }
}

// Clear checkin markers
clearCheckinMarkers(): void {
  // We need to track checkin markers separately, for now we'll re-initialize map
  // This is a simplified approach - ideally checkin markers should be tracked in an array
  if (this.map) {
    this.map.eachLayer((layer: any) => {
      if (layer.options && layer.options.icon && layer.options.icon.options &&
          layer.options.icon.options.className === 'custom-numbered-marker') {
        this.map.removeLayer(layer);
      }
    });
  }
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

// Load Permission Report from BackgroundLocationProcess/getPermissionReport
loadPermissionReportData(): void {
  const userIdToUse = this.selectedUserId || this.payload.user_id;
  this.permissionReportLoading = true;

  const header = {
    'date': this.selectedDate,
    'user_id': userIdToUse
  };

  this.service.post_rqst(header, "BackgroundLocationProcess/getPermissionReport")
    .subscribe(
      (result: any) => {
        this.permissionReportData = result || null;
        this.permissionReportLoading = false;
        console.log('Permission Report data:', this.permissionReportData);
      },
      (error) => {
        console.error('Error loading permission report:', error);
        this.permissionReportLoading = false;
        this.permissionReportData = null;
      }
    );
}

// Get permission keys from the report data
getPermissionKeys(): string[] {
  if (!this.permissionReportData.permissions) return [];
  return Object.keys(this.permissionReportData.permissions);
}

// Get status class for permission
getPermissionStatusClass(permission: any): string {
  if (permission.enabled_percentage === 100) return 'success';
  if (permission.enabled_percentage >= 80) return 'warning';
  return 'danger';
}

// Get icon for permission type
getPermissionReportIcon(key: string): string {
  const iconMap: any = {
    'fine_location': 'my_location',
    'coarse_location': 'location_searching',
    'background_location': 'share_location',
    'is_gps_enabled': 'gps_fixed',
    'is_location_enabled': 'location_on',
    'is_internet_on': 'wifi',
    'is_battery_optimized': 'battery_saver',
    'is_power_save_mode': 'power_settings_new'
  };
  return iconMap[key] || 'settings';
}

// Format duration for display
formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins} min ${secs} sec` : `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
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
      this.loadMonthlyKmData();
      this.UserInformationDetail();
      this.loadGetDayActivityTimeline()
      this.loadGetPermissionReport()
      this.loadHoldPointsAndPermissionLocations()

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

  // ============================================
  // KM CALENDAR METHODS
  // ============================================

  initializeKmCalendar(): void {
    // Generate available years (current year and 2 years back)
    const currentYear = new Date().getFullYear();
    this.availableYears = [];
    for (let i = currentYear; i >= currentYear - 2; i--) {
      this.availableYears.push(i);
    }
    this.selectedKmMonth = new Date().getMonth() + 1;
    this.selectedKmYear = currentYear;
  }

  loadMonthlyKmData(): void {
    const userIdToUse = this.selectedUserId || this.payload.user_id;

    if (!userIdToUse) {
      console.log('No user selected for KM Calendar');
      return;
    }

    this.isLoadingKmCalendar = true;
    this.kmCalendarData = null;
    this.calendarWeeks = [];

    let header = {
      'user_id': userIdToUse,
      'month': this.selectedKmMonth,
      'year': this.selectedKmYear
    };

    this.service.post_rqst(header, "BackgroundLocationProcess/getMonthlyKmData")
      .subscribe((result: any) => {
        console.log('KM Calendar Result:', result);
        if (result && result.result) {
          this.kmCalendarData = result.result;
          this.buildCalendarWeeks();
        }
        this.isLoadingKmCalendar = false;
      }, (error) => {
        console.error('Error loading KM data:', error);
        this.isLoadingKmCalendar = false;
      });
  }

  buildCalendarWeeks(): void {
    if (!this.kmCalendarData || !this.kmCalendarData.calendar_data) {
      this.calendarWeeks = [];
      return;
    }

    const calendarData = this.kmCalendarData.calendar_data;

    // Get the first day of the month
    const firstDay = new Date(this.selectedKmYear, this.selectedKmMonth - 1, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Create a map of dates to data
    const dateMap = new Map();
    calendarData.forEach((day: any) => {
      dateMap.set(day.date, day);
    });

    // Build weeks array
    this.calendarWeeks = [];
    let currentWeek: any[] = [];

    // Add empty cells for days before the first day of month
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }

    // Get number of days in month
    const daysInMonth = new Date(this.selectedKmYear, this.selectedKmMonth, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${this.selectedKmYear}-${String(this.selectedKmMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayData = dateMap.get(dateStr) || {
        date: dateStr,
        day: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }),
        km_per_day: null,
        has_attendance: false
      };

      currentWeek.push(dayData);

      if (currentWeek.length === 7) {
        this.calendarWeeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Fill remaining days of last week with empty cells
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      this.calendarWeeks.push(currentWeek);
    }
  }

  navigateMonth(direction: number): void {
    this.selectedKmMonth += direction;

    if (this.selectedKmMonth > 12) {
      this.selectedKmMonth = 1;
      this.selectedKmYear++;
    } else if (this.selectedKmMonth < 1) {
      this.selectedKmMonth = 12;
      this.selectedKmYear--;
    }

    this.loadMonthlyKmData();
  }

  isCurrentMonth(): boolean {
    const now = new Date();
    return this.selectedKmMonth === now.getMonth() + 1 && this.selectedKmYear === now.getFullYear();
  }

  isFutureDate(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  }

  getDayNumber(dateStr: string): number {
    if (!dateStr) return 0;
    return new Date(dateStr).getDate();
  }

  selectKmDay(day: any): void {
    this.selectedKmDay = day;
  }

  closeKmDayDetails(): void {
    this.selectedKmDay = null;
  }

  viewDayOnMap(dateStr: string): void {
    this.selectedDate = dateStr;
    this.closeKmDayDetails();
    this.switchTab('route');
    this.initializeData();
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

  // ============ NEW LOGIC: Active time from first checkin to last checkout/checkin ============
  // Calculate active time based on checkins: first checkin (visit_start) to last checkout (visit_end) or last checkin (visit_start)
  if (this.checkin && this.checkin.length > 0) { 
    // Sort checkins by visit_start to ensure correct order
    const sortedCheckins = this.checkin.slice().sort((a, b) =>
      new Date(a.visit_start).getTime() - new Date(b.visit_start).getTime()
    );

    // Get first checkin time
    const firstCheckinTime = sortedCheckins[0].visit_start;

    // Get last checkout time or last checkin time if no checkout
    let lastTime: string;
    // Find the last checkin that has a visit_end (checkout)
    const checkinsWithCheckout = sortedCheckins.filter(c => c.visit_end && c.visit_end !== '' && c.visit_end !== null);

    if (checkinsWithCheckout.length > 0) {
      // Sort by visit_end to get the latest checkout
      const sortedByCheckout = checkinsWithCheckout.slice().sort((a, b) =>
        new Date(b.visit_end).getTime() - new Date(a.visit_end).getTime()
      );
      lastTime = sortedByCheckout[0].visit_end;
    } else {
      // No checkout found, use the last checkin's visit_start
      lastTime = sortedCheckins[sortedCheckins.length - 1].visit_start;
    }

    // Calculate duration
    const startMoment = moment(firstCheckinTime);
    const endMoment = moment(lastTime);
    const duration = moment.duration(endMoment.diff(startMoment));

    // Format as "Xh Ym"
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();

    this.activeTime = `${hours}h ${minutes}m`;
  } else {
    // If there are no check-ins, set active time to 0.
    this.activeTime = "0h 0m";
  }
  // ============ END NEW LOGIC ============

  // ============ OLD LOGIC: Active time from attendance start_time to stop_time ============
  // To use OLD LOGIC: Comment out the NEW LOGIC block above and uncomment the block below
  /*
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
  */
  // ============ END OLD LOGIC ============

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
  showSelectUserAlert: boolean = false;

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

    this.service.post_rqst(header, "BackgroundLocationProcess/getLiveLocations")
      .subscribe(
        (result) => {
          this.liveUsersData = result['locations'] || [];
          this.filterLiveUsers();
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
    this.liveUsersData.forEach((userData: LiveLocationUser) => {
      if (!userData.latitude || !userData.longitude) return;

      const isSelected = this.selectedLiveUsers.size === 0 ||
                        this.selectedLiveUsers.has(userData.user_id.toString());

      if (!isSelected) return;

      // Create custom icon based on user status
      const iconHtml = this.createUserMarkerHtml(userData);
      const icon = L.divIcon({
        className: 'live-user-marker',
        html: iconHtml,
        iconSize: [48, 56],
        iconAnchor: [24, 56]
      });

      // Create marker
      const marker = L.marker([userData.latitude, userData.longitude], { icon })
        .addTo(this.liveUsersMap);

      // Add popup with user details - with custom options for better display
      const popupContent = this.createUserPopupContent(userData);
      marker.bindPopup(popupContent, {
        maxWidth: 320,
        minWidth: 260,
        className: 'live-user-popup',
        closeButton: true,
        autoPan: true,
        autoPanPadding: [20, 20]
      });

      // Add accuracy circle if available
      if (userData.accuracy) {
        const circle = L.circle([userData.latitude, userData.longitude], {
          radius: userData.accuracy,
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
    // Support both new flat structure and legacy nested structure
    let isMoving = false;
    if (userData.is_moving !== undefined) {
      isMoving = userData.is_moving === 1;
    } else if (userData.movement && userData.movement.is_moving != null) {
      isMoving = userData.movement.is_moving;
    }

    let batteryLevel = 0;
    if (userData.battery_level !== undefined) {
      batteryLevel = userData.battery_level;
    } else if (userData.device && userData.device.battery_level != null) {
      batteryLevel = userData.device.battery_level;
    }

    let userName = 'Unknown';
    if (userData.name) {
      userName = userData.name;
    } else if (userData.user && userData.user.name) {
      userName = userData.user.name;
    }
    const initials = this.getInitials(userName);

    // Gradient colors based on status
    const gradientStart = isMoving ? '#22c55e' : '#6366f1';
    const gradientEnd = isMoving ? '#16a34a' : '#8b5cf6';

    // Battery indicator color
    const batteryColor = batteryLevel < 20 ? '#ef4444' : batteryLevel < 50 ? '#f59e0b' : '#22c55e';

    return `
      <div class="live-marker-container" style="
        position: relative;
        width: 48px;
        height: 56px;
      ">
        <!-- Main marker body -->
        <div style="
          background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%);
          width: 44px;
          height: 44px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.1);
          position: absolute;
          top: 0;
          left: 2px;
        ">
          <span style="
            transform: rotate(45deg);
            color: white;
            font-size: 14px;
            font-weight: 700;
            letter-spacing: 0.5px;
          ">${initials}</span>
        </div>

        <!-- Status ring animation for moving users -->
        ${isMoving ? `
          <div style="
            position: absolute;
            top: -4px;
            left: -2px;
            width: 52px;
            height: 52px;
            border: 2px solid ${gradientStart};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            animation: pulse-ring 2s ease-out infinite;
            opacity: 0.6;
          "></div>
        ` : ''}

        <!-- Battery indicator -->
        <div style="
          position: absolute;
          bottom: 0;
          right: -2px;
          background: white;
          border-radius: 10px;
          padding: 2px 5px;
          display: flex;
          align-items: center;
          gap: 2px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          font-size: 9px;
          font-weight: 600;
          color: ${batteryColor};
        ">
          <span style="
            width: 12px;
            height: 6px;
            border: 1px solid ${batteryColor};
            border-radius: 1px;
            position: relative;
            display: inline-block;
          ">
            <span style="
              position: absolute;
              left: 1px;
              top: 1px;
              height: 4px;
              width: ${Math.min(batteryLevel, 100) * 0.08}px;
              background: ${batteryColor};
              border-radius: 0.5px;
            "></span>
          </span>
          ${batteryLevel}%
        </div>
      </div>

      <style>
        @keyframes pulse-ring {
          0% { transform: rotate(-45deg) scale(1); opacity: 0.6; }
          100% { transform: rotate(-45deg) scale(1.3); opacity: 0; }
        }
      </style>
    `;
  }

  createUserPopupContent(userData: any): string {
    // Support both new flat structure and legacy nested structure
    let isMoving = false;
    if (userData.is_moving !== undefined) {
      isMoving = userData.is_moving === 1;
    } else if (userData.movement && userData.movement.is_moving != null) {
      isMoving = userData.movement.is_moving;
    }

    let batteryLevel = 0;
    if (userData.battery_level !== undefined) {
      batteryLevel = userData.battery_level;
    } else if (userData.device && userData.device.battery_level != null) {
      batteryLevel = userData.device.battery_level;
    }

    let userName = 'Unknown';
    if (userData.name) {
      userName = userData.name;
    } else if (userData.user && userData.user.name) {
      userName = userData.user.name;
    }

    let activity = 'unknown';
    if (userData.activity_type) {
      activity = userData.activity_type;
    } else if (userData.movement && userData.movement.activity) {
      activity = userData.movement.activity;
    }

    let speed = 0;
    if (userData.speed !== undefined) {
      speed = userData.speed;
    } else if (userData.movement && userData.movement.speed) {
      speed = userData.movement.speed;
    }

    let accuracy: any = '--';
    if (userData.accuracy !== undefined) {
      accuracy = userData.accuracy;
    } else if (userData.location && userData.location.accuracy) {
      accuracy = userData.location.accuracy;
    }

    let contact = 'N/A';
    if (userData.contact_01) {
      contact = userData.contact_01;
    } else if (userData.user && userData.user.contact_01) {
      contact = userData.user.contact_01;
    }
    const isOnline = userData.is_online !== undefined ? userData.is_online : true;
    const isCharging = userData.is_charging === 1;
    const minutesAgo = userData.minutes_ago || 0;
    const updatedAt = userData.updated_at || '';

    const gradientStart = isMoving ? '#22c55e' : '#6366f1';
    const gradientEnd = isMoving ? '#16a34a' : '#8b5cf6';
    const batteryColor = batteryLevel < 20 ? '#ef4444' : batteryLevel < 50 ? '#f59e0b' : '#22c55e';
    const activityFormatted = this.formatActivity(activity);
    const onlineStatusColor = isOnline ? '#22c55e' : '#9ca3af';
    const onlineStatusText = isOnline ? 'Online' : `${minutesAgo} min ago`;

    return `
      <div style="
        min-width: 280px;
        max-width: 320px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      ">
        <!-- Header with gradient -->
        <div style="
          background: linear-gradient(135deg, ${gradientStart} 0%, ${gradientEnd} 100%);
          padding: 16px;
          color: white;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="
              width: 48px;
              height: 48px;
              background: rgba(255,255,255,0.2);
              border-radius: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 18px;
              font-weight: 700;
              position: relative;
            ">
              ${this.getInitials(userName)}
              <span style="
                position: absolute;
                bottom: -2px;
                right: -2px;
                width: 12px;
                height: 12px;
                background: ${onlineStatusColor};
                border-radius: 50%;
                border: 2px solid white;
              "></span>
            </div>
            <div style="flex: 1;">
              <div style="font-size: 16px; font-weight: 600; margin-bottom: 2px;">${userName}</div>
              <div style="font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 4px;">
                <i class="material-icons" style="font-size: 14px;">phone</i>
                ${contact}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="
                background: rgba(255,255,255,0.2);
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 600;
                margin-bottom: 4px;
              ">${isMoving ? 'MOVING' : 'STATIONARY'}</div>
              <div style="font-size: 10px; opacity: 0.8;">${onlineStatusText}</div>
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div style="
          padding: 16px;
          background: white;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        ">
          <!-- Activity -->
          <div style="
            background: #f8fafc;
            padding: 10px 12px;
            border-radius: 8px;
            border-left: 3px solid ${gradientStart};
          ">
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Activity</div>
            <div style="font-size: 13px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 4px;">
              <i class="material-icons" style="font-size: 16px; color: ${gradientStart};">${this.getActivityIcon(activity)}</i>
              ${activityFormatted}
            </div>
          </div>

          <!-- Speed -->
          <div style="
            background: #f8fafc;
            padding: 10px 12px;
            border-radius: 8px;
            border-left: 3px solid #3b82f6;
          ">
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Speed</div>
            <div style="font-size: 13px; font-weight: 600; color: #1e293b;">
              ${speed} <span style="font-size: 11px; color: #64748b;">km/h</span>
            </div>
          </div>

          <!-- Battery -->
          <div style="
            background: #f8fafc;
            padding: 10px 12px;
            border-radius: 8px;
            border-left: 3px solid ${batteryColor};
          ">
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
              Battery ${isCharging ? '<i class="material-icons" style="font-size: 12px; color: #22c55e;">bolt</i>' : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="
                flex: 1;
                height: 6px;
                background: #e2e8f0;
                border-radius: 3px;
                overflow: hidden;
              ">
                <div style="
                  width: ${batteryLevel}%;
                  height: 100%;
                  background: ${batteryColor};
                  border-radius: 3px;
                "></div>
              </div>
              <span style="font-size: 13px; font-weight: 600; color: ${batteryColor};">${batteryLevel}%</span>
            </div>
          </div>

          <!-- Accuracy -->
          <div style="
            background: #f8fafc;
            padding: 10px 12px;
            border-radius: 8px;
            border-left: 3px solid #8b5cf6;
          ">
            <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">GPS Accuracy</div>
            <div style="font-size: 13px; font-weight: 600; color: #1e293b;">
              ${typeof accuracy === 'number' ? accuracy.toFixed(1) : accuracy} <span style="font-size: 11px; color: #64748b;">meters</span>
            </div>
          </div>
        </div>

        <!-- Online Status Footer -->
        <div style="
          padding: 12px 16px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        ">
          <span style="font-size: 12px; color: #64748b;">Status</span>
          <span style="
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            background: ${isOnline ? '#dcfce7' : '#f3f4f6'};
            color: ${isOnline ? '#16a34a' : '#6b7280'};
          ">${isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        ${updatedAt ? `
        <!-- Last Updated -->
        <div style="
          padding: 8px 16px;
          background: #f1f5f9;
          font-size: 11px;
          color: #64748b;
          text-align: center;
        ">
          Last updated: ${updatedAt}
        </div>
        ` : ''}
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
    return this.liveUsersData.filter((u: any) => {
      // Support both new flat structure and legacy nested structure
      const isMoving = u.is_moving !== undefined ? u.is_moving === 1 : u.movement.is_moving;
      return isMoving;
    }).length;
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

  // Filter live users based on search term
  filterLiveUsers(): void {
    if (!this.liveUserSearchTerm || this.liveUserSearchTerm.trim() === '') {
      this.filteredLiveUsersData = this.liveUsersData.slice();
    } else {
      const searchLower = this.liveUserSearchTerm.toLowerCase().trim();
      this.filteredLiveUsersData = this.liveUsersData.filter((user: any) => {
        // Support both new flat structure and legacy nested structure
        const userName = user.name || user.user.name || '';
        const userContact = user.contact_01.toString() || user.user.employee_id || '';
        return userName.toLowerCase().includes(searchLower) ||
               userContact.toLowerCase().includes(searchLower);
      });
    }
  }

  // Get user initials for avatar
  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Get time ago string
  getTimeAgo(timestamp: string): string {
    if (!timestamp) return '';
    const now = moment();
    const time = moment(timestamp);
    const diffMinutes = now.diff(time, 'minutes');

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = now.diff(time, 'hours');
    if (diffHours < 24) return `${diffHours}h ago`;

    return time.format('MMM D');
  }

  // Get activity class for styling
  getActivityClass(activity: string): string {
    if (!activity) return 'activity-unknown';
    return 'activity-' + activity.toLowerCase().replace(/\s+/g, '_');
  }

  // Get activity icon
  getActivityIcon(activity: string): string {
    const icons: any = {
      'still': 'person_pin',
      'walking': 'directions_walk',
      'on_foot': 'directions_walk',
      'running': 'directions_run',
      'in_vehicle': 'directions_car',
      'driving': 'directions_car',
      'on_bicycle': 'directions_bike',
      'tilting': 'screen_rotation',
      'unknown': 'help_outline'
    };
    return icons[activity.toLowerCase()] || 'help_outline';
  }

  // Format activity text
  formatActivity(activity: string): string {
    if (!activity) return 'Unknown';
    return activity.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Clear all user selections
  clearAllSelections(): void {
    this.selectedLiveUsers.clear();
    this.updateLiveUsersOnMap();
  }

  // Focus on a specific user on the map
  focusOnUser(userData: any): void {
    if (!this.liveUsersMap) return;

    // Support both new flat structure and legacy nested structure
    const lat = userData.latitude || userData.location.lat;
    const lng = userData.longitude || userData.location.lng;

    if (!lat || !lng) return;

    this.liveUsersMap.setView(
      [lat, lng],
      16,
      { animate: true, duration: 0.5 }
    );
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

    // Enhanced popup content - Compact version
    const popupContent = `
      <div style="min-width: 180px; max-width: 240px; font-size: 11px;">
        <div style="background: ${iconColor}; color: white; padding: 6px 8px; border-radius: 4px 4px 0 0;">
          <strong style="font-size: 12px;">${event.title}</strong>
        </div>
        <div style="padding: 6px 8px; display: grid; gap: 4px; background: #f5f5f5; border-radius: 0 0 4px 4px;">
          <div><i class="material-icons" style="font-size: 12px; vertical-align: middle; color: #666;">access_time</i> ${event.time}${event.end_time ? ' - ' + event.end_time : ''}</div>
          <div><i class="material-icons" style="font-size: 12px; vertical-align: middle; color: #666;">label</i> ${markerTitle}</div>
          ${event.duration_minutes ? `<div><i class="material-icons" style="font-size: 12px; vertical-align: middle; color: #666;">timer</i> ${event.duration_minutes} mins</div>` : ''}
          ${event.location.address ? `<div style="font-size: 10px; color: #666; margin-top: 2px;"><i class="material-icons" style="font-size: 11px; vertical-align: middle;">location_on</i> ${event.location.address.length > 50 ? event.location.address.substring(0, 50) + '...' : event.location.address}</div>` : ''}
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
