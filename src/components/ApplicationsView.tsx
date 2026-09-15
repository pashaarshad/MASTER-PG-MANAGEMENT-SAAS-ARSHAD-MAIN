import React, { useState, useEffect } from 'react';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  Building,
  BedDouble,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CreditCard,
  Check,
  X,
  Share2,
} from 'lucide-react';
import { usePG } from '../context/PGContext';
import { ResidentApplication, Room, Bed, Resident } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { ShareDetailsModal } from './ShareDetailsModal';
import { AadhaarDocumentViewerModal } from './AadhaarDocumentViewerModal';
import { Avatar } from './Avatar';

export const ApplicationsView: React.FC = () => {
  const {
    applications,
    buildings,
    floors,
    rooms,
    approveApplication,
    rejectApplication,
    requestCorrection,
    selectedApplicationId,
    setSelectedApplicationId,
    refreshData,
  } = usePG();

  // Refresh latest database data when view mounts or actions occur
  useEffect(() => {
    refreshData(false);
  }, [refreshData]);

  const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');

  // Allocation Modal State
  const [approvingApp, setApprovingApp] = useState<ResidentApplication | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(buildings[0]?.id || '');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [monthlyRent, setMonthlyRent] = useState<number>(8500);
  const [securityDeposit, setSecurityDeposit] = useState<number>(10000);
  const [moveInDate, setMoveInDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Reject / Correction Modal state
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [correctingAppId, setCorrectingAppId] = useState<string | null>(null);
  const [correctionNote, setCorrectionNote] = useState<string>('');

  // Post approval share modal
  const [allocatedResident, setAllocatedResident] = useState<Resident | null>(null);

  // Viewing Aadhaar / KYC Document
  const [viewingAadhaarApp, setViewingAadhaarApp] = useState<ResidentApplication | null>(null);

  // Filtered applications
  const filteredApps = applications.filter((app) => {
    if (activeTab !== 'ALL' && app.status !== activeTab) return false;
    return true;
  });

  const activeApp = applications.find((a) => a.id === selectedApplicationId) || null;

  // Helper to match rooms to floor reliably (by ID, Name, floor object, or room prefix)
  const isFloorMatch = (room: Room, targetFloorId: string, targetBuildingId: string) => {
    if (room.buildingId && targetBuildingId && room.buildingId !== targetBuildingId) {
      return false;
    }
    if (!targetFloorId || targetFloorId === 'ALL') return true;
    if (room.floorId === targetFloorId) return true;

    const targetFloorObj = floors.find((f) => f.id === targetFloorId);
    const roomFloorIdLower = (room.floorId || '').toLowerCase();
    const rNumLower = (room.roomNumber || '').toLowerCase();

    if (targetFloorObj) {
      const targetNameLower = targetFloorObj.name.toLowerCase();

      if (room.floorId === targetFloorObj.id || roomFloorIdLower === targetNameLower) {
        return true;
      }

      // Check floor name text & room prefix matching
      if (
        (targetNameLower.includes('ground') || targetNameLower.includes('flr-g') || targetNameLower.includes('flr-0')) &&
        (roomFloorIdLower.includes('ground') || roomFloorIdLower.includes('flr-g') || roomFloorIdLower.includes('flr-0') || rNumLower.startsWith('g'))
      ) {
        return true;
      }

      if (
        (targetNameLower.includes('1st') || targetNameLower.includes('floor 1')) &&
        (roomFloorIdLower.includes('1st') || roomFloorIdLower.includes('flr-1') || rNumLower.startsWith('1'))
      ) {
        return true;
      }

      if (
        (targetNameLower.includes('2nd') || targetNameLower.includes('floor 2')) &&
        (roomFloorIdLower.includes('2nd') || roomFloorIdLower.includes('flr-2') || rNumLower.startsWith('2'))
      ) {
        return true;
      }
    }

    const roomFloorObj = floors.find((f) => f.id === room.floorId);
    if (roomFloorObj && targetFloorObj && roomFloorObj.name.toLowerCase() === targetFloorObj.name.toLowerCase()) {
      return true;
    }

    return false;
  };

  const getAvailableRoomsForFloor = (fId: string, bId: string) => {
    const availableRooms = rooms.filter((r) => r.beds && r.beds.some((b) => b.status === 'Available'));
    
    // 1. Exact, name, or room-prefix match on selected floor & building
    const exactMatches = availableRooms.filter((r) => isFloorMatch(r, fId, bId));
    if (exactMatches.length > 0) return exactMatches;

    // 2. Building match fallback
    const buildingMatches = availableRooms.filter((r) => !r.buildingId || r.buildingId === bId);
    if (buildingMatches.length > 0) return buildingMatches;

    // 3. Ultimate fallback: All available rooms in system
    return availableRooms;
  };

  // Setup initial room and bed options when approving
  const handleOpenApproveModal = async (app: ResidentApplication) => {
    // Refresh latest database data before showing modal
    refreshData(false);
    setApprovingApp(app);
    const bId = buildings[0]?.id || '';
    setSelectedBuildingId(bId);

    const bFloors = floors.filter((f) => f.buildingId === bId);
    const fId = bFloors[0]?.id || '';
    setSelectedFloorId(fId);

    const availRooms = getAvailableRoomsForFloor(fId, bId);
    const rId = availRooms[0]?.id || '';
    setSelectedRoomId(rId);

    const targetRoom = rooms.find((r) => r.id === rId);
    const availBed = targetRoom?.beds.find((b) => b.status === 'Available');
    setSelectedBedId(availBed?.id || '');
    if (targetRoom) setMonthlyRent(targetRoom.baseRent);
  };

  const handleConfirmApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingApp || !selectedRoomId || !selectedBedId) {
      alert('Please select a valid Room and Available Bed.');
      return;
    }

    try {
      const result = approveApplication(approvingApp.id, {
        buildingId: selectedBuildingId,
        floorId: selectedFloorId,
        roomId: selectedRoomId,
        bedId: selectedBedId,
        monthlyRent,
        securityDeposit,
        moveInDate,
      });

      setApprovingApp(null);
      setSelectedApplicationId(null);
      // Open share modal
      setAllocatedResident(result.resident);
    } catch (err: any) {
      alert(err.message || 'Error approving application');
    }
  };

  // Rooms for selected floor that have at least one available bed
  const eligibleRooms = getAvailableRoomsForFloor(selectedFloorId, selectedBuildingId);

  const currentSelectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const eligibleBeds = currentSelectedRoom?.beds.filter((b) => b.status === 'Available') || [];

  return (
    <div id="applications-view-container" className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Tenant Applications
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            KYC review, ID generation & room allocation
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
              activeTab === 'PENDING'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Pending ({applications.filter((a) => a.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setActiveTab('APPROVED')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
              activeTab === 'APPROVED'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Approved ({applications.filter((a) => a.status === 'APPROVED').length})
          </button>
          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
              activeTab === 'REJECTED'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Rejected ({applications.filter((a) => a.status === 'REJECTED').length})
          </button>
          <button
            onClick={() => setActiveTab('ALL')}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
              activeTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All ({applications.length})
          </button>
        </div>
      </div>

      {/* Applications List */}
      {filteredApps.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 mb-1">No Applications in this Tab</h3>
          <p className="text-xs text-slate-500">All applications have been processed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              id={`application-card-${app.id}`}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between"
            >
              <div>
                {/* Header & Status */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={app.photoUrl}
                      name={app.fullName}
                      size="md"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900">{app.fullName}</h3>
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {app.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{app.occupation}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                      app.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : app.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-1.5 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Contact:</span>
                    <span className="font-semibold text-slate-800 font-mono">{app.mobile}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="text-slate-700">{app.email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Aadhaar (Masked):</span>
                    <button
                      type="button"
                      onClick={() => setViewingAadhaarApp(app)}
                      className="font-mono text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>{app.aadharNumberMasked}</span>
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Rules Accepted:</span>
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> {app.acceptedRulesVersion}
                    </span>
                  </div>
                </div>

                {/* Emergency contact */}
                <p className="text-[11px] text-slate-500 mb-2">
                  Emergency: <strong>{app.emergencyContact.name}</strong> ({app.emergencyContact.relationship}) •{' '}
                  <span className="font-mono">{app.emergencyContact.phone}</span>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">
                  Submitted {formatDate(app.submittedAt)}
                </span>

                <div className="flex items-center gap-2">
                  {app.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => {
                          setRejectingAppId(app.id);
                        }}
                        className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition font-medium"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleOpenApproveModal(app)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve & Allocate</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve & Room Allocation Modal */}
      {approvingApp && (
        <div
          id="approve-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setApprovingApp(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Approve & Allocate Room: {approvingApp.fullName}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Select available building, floor, room and assign specific bed.
            </p>

            <form onSubmit={handleConfirmApproval} className="space-y-3.5 flex-1 overflow-y-auto pr-1">
              {/* Building & Floor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Building</label>
                  <select
                    value={selectedBuildingId}
                    onChange={(e) => {
                      const newBId = e.target.value;
                      setSelectedBuildingId(newBId);
                      const bFloors = floors.filter((f) => f.buildingId === newBId);
                      const newFId = bFloors[0]?.id || '';
                      setSelectedFloorId(newFId);
                      const fRooms = getAvailableRoomsForFloor(newFId, newBId);
                      const newRId = fRooms[0]?.id || '';
                      setSelectedRoomId(newRId);
                      const targetRoom = rooms.find((r) => r.id === newRId);
                      setSelectedBedId(targetRoom?.beds.find((b) => b.status === 'Available')?.id || '');
                      if (targetRoom) setMonthlyRent(targetRoom.baseRent);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Floor</label>
                  <select
                    value={selectedFloorId}
                    onChange={(e) => {
                      const newFId = e.target.value;
                      setSelectedFloorId(newFId);
                      const fRooms = getAvailableRoomsForFloor(newFId, selectedBuildingId);
                      const newRId = fRooms[0]?.id || '';
                      setSelectedRoomId(newRId);
                      const targetRoom = rooms.find((r) => r.id === newRId);
                      setSelectedBedId(targetRoom?.beds.find((b) => b.status === 'Available')?.id || '');
                      if (targetRoom) setMonthlyRent(targetRoom.baseRent);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    {floors
                      .filter((f) => f.buildingId === selectedBuildingId)
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Room & Bed */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Room (Has Available Beds)
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => {
                      setSelectedRoomId(e.target.value);
                      const targetRoom = rooms.find((r) => r.id === e.target.value);
                      const avail = targetRoom?.beds.find((b) => b.status === 'Available');
                      setSelectedBedId(avail?.id || '');
                      if (targetRoom) setMonthlyRent(targetRoom.baseRent);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    {eligibleRooms.length === 0 ? (
                      <option value="">No rooms with available beds</option>
                    ) : (
                      eligibleRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.roomNumber} ({r.sharingType})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bed Number (🟢 Available)
                  </label>
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    {eligibleBeds.length === 0 ? (
                      <option value="">No available bed</option>
                    ) : (
                      eligibleBeds.map((b) => (
                        <option key={b.id} value={b.id}>
                          🟢 Bed {b.bedNumber}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Monthly Rent & Security Deposit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={monthlyRent === 0 ? '' : monthlyRent}
                    onChange={(e) => setMonthlyRent(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Security Deposit (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={securityDeposit === 0 ? '' : securityDeposit}
                    onChange={(e) => setSecurityDeposit(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Move-in / Joining Date</label>
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="bg-indigo-50 border border-indigo-200/60 rounded-xl p-3 text-xs text-indigo-900">
                <p className="font-semibold mb-0.5">Automatic Resident ID Generation</p>
                <p className="text-[11px] text-indigo-700">
                  Approving will issue a unique Resident ID (e.g. RES-1043), occupy the chosen bed, and generate shareable WhatsApp & Email details.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApprovingApp(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  Confirm & Allocate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingAppId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
            <h3 className="text-base font-bold text-slate-900 mb-2">Reject Application</h3>
            <textarea
              placeholder="State reason for rejection..."
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs mb-3"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingAppId(null)}
                className="px-3 py-1.5 text-xs text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  rejectApplication(rejectingAppId, rejectionReason || 'Application criteria not met');
                  setRejectingAppId(null);
                  setRejectionReason('');
                }}
                className="px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-xl"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal on Post Approval */}
      <ShareDetailsModal
        isOpen={Boolean(allocatedResident)}
        onClose={() => setAllocatedResident(null)}
        resident={allocatedResident}
      />

      {/* Aadhaar Document Viewer Modal */}
      <AadhaarDocumentViewerModal
        isOpen={Boolean(viewingAadhaarApp)}
        onClose={() => setViewingAadhaarApp(null)}
        documentData={viewingAadhaarApp}
        onUpdateAadhaarUrl={(newUrl) => {
          if (viewingAadhaarApp) {
            setViewingAadhaarApp({
              ...viewingAadhaarApp,
              aadharUrl: newUrl,
            });
          }
        }}
      />
    </div>
  );
};
