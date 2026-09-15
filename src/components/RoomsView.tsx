import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  BedDouble,
  CheckCircle2,
  Wrench,
  XCircle,
  Filter,
  Layers,
  ChevronDown,
  X,
  AlertTriangle,
} from 'lucide-react';
import { usePG } from '../context/PGContext';
import { BedStatus, SharingType, Room, Building } from '../types';
import { formatCurrency } from '../utils/helpers';
import { SensitiveEditModal } from './SensitiveEditModal';

export const RoomsView: React.FC = () => {
  const {
    buildings,
    floors,
    rooms,
    addRoom,
    editRoom,
    deleteRoom,
    updateBedStatus,
    addBuilding,
    editBuilding,
    deleteBuilding,
    addFloor,
    setActiveView,
    setSelectedResidentId,
  } = usePG();

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('ALL');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'>('ALL');

  // Modals state
  const [showAddRoomModal, setShowAddRoomModal] = useState<boolean>(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [showAddBuildingModal, setShowAddBuildingModal] = useState<boolean>(false);
  const [showAddFloorModal, setShowAddFloorModal] = useState<boolean>(false);
  const [buildingToDelete, setBuildingToDelete] = useState<Building | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  // Sensitive edit protection (Passcode 6565)
  const [showSensitiveEditModal, setShowSensitiveEditModal] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const triggerProtectedAction = (action: () => void) => {
    setPendingAction(() => action);
    setShowSensitiveEditModal(true);
  };

  // New room form state
  const [newRoomNumber, setNewRoomNumber] = useState<string>('');
  const [newBuildingId, setNewBuildingId] = useState<string>(buildings[0]?.id || '');
  const [selectedFloorName, setSelectedFloorName] = useState<string>('Ground Floor');
  const [customFloorName, setCustomFloorName] = useState<string>('');
  const [newSharingType, setNewSharingType] = useState<SharingType>('3-Sharing');
  const [newCapacity, setNewCapacity] = useState<number>(3);
  const [newBaseRent, setNewBaseRent] = useState<number>(8500);

  // Edit room form state
  const [editRoomNumber, setEditRoomNumber] = useState<string>('');
  const [editBuildingId, setEditBuildingId] = useState<string>('');
  const [editFloorName, setEditFloorName] = useState<string>('Ground Floor');
  const [editCustomFloorName, setEditCustomFloorName] = useState<string>('');
  const [editSharingType, setEditSharingType] = useState<SharingType>('3-Sharing');
  const [editCapacity, setEditCapacity] = useState<number>(3);
  const [editBaseRent, setEditBaseRent] = useState<number>(8500);
  const [editRoomStatus, setEditRoomStatus] = useState<'Active' | 'Maintenance'>('Active');

  const STANDARD_FLOORS = [
    'Ground Floor',
    '1st Floor',
    '2nd Floor',
    '3rd Floor',
    '4th Floor',
    '5th Floor',
    '6th Floor',
    'Custom Floor',
  ];

  // Helper to resolve floor name reliably
  const getRoomFloorName = (roomFloorId: string): string => {
    if (!roomFloorId) return 'Ground Floor';
    const found = floors.find(
      (f) => f.id === roomFloorId || f.name.toLowerCase() === roomFloorId.toLowerCase()
    );
    if (found) return found.name;
    if (!roomFloorId.startsWith('flr-')) return roomFloorId;
    return 'Ground Floor';
  };

  // Open Edit Room Modal with current values
  const openEditRoom = (room: Room) => {
    setEditingRoom(room);
    setEditRoomNumber(room.roomNumber);
    setEditBuildingId(room.buildingId || buildings[0]?.id || '');
    const floorName = getRoomFloorName(room.floorId);
    if (STANDARD_FLOORS.includes(floorName)) {
      setEditFloorName(floorName);
      setEditCustomFloorName('');
    } else {
      setEditFloorName('Custom Floor');
      setEditCustomFloorName(floorName);
    }
    setEditSharingType(room.sharingType);
    setEditCapacity(room.capacity || room.beds?.length || 1);
    setEditBaseRent(room.baseRent);
    setEditRoomStatus(room.status || 'Active');
  };

  const getSharingTypeFromCapacity = (cap: number): SharingType => {
    if (cap === 1) return 'Single';
    if (cap === 2) return '2-Sharing';
    if (cap === 3) return '3-Sharing';
    if (cap === 4) return '4-Sharing';
    return 'Custom';
  };

  const updateEditCapacity = (editCap: number) => {
    const clamped = Math.max(0, editCap);
    setEditCapacity(clamped);
    setEditSharingType(getSharingTypeFromCapacity(clamped));
  };

  const handleEditSharingChange = (type: SharingType) => {
    setEditSharingType(type);
    if (type === 'Single') setEditCapacity(1);
    else if (type === '2-Sharing') setEditCapacity(2);
    else if (type === '3-Sharing') setEditCapacity(3);
    else if (type === '4-Sharing') setEditCapacity(4);
  };

  const handleSaveEditRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    const floorName =
      editFloorName === 'Custom Floor' ? editCustomFloorName.trim() || 'Extra Floor' : editFloorName;
    const finalFloorId = resolveFloorId(editBuildingId, floorName);

    const existingBeds = editingRoom.beds || [];
    let updatedBeds = [...existingBeds];

    if (editCapacity > existingBeds.length) {
      // Add new beds
      for (let i = existingBeds.length; i < editCapacity; i++) {
        updatedBeds.push({
          id: `bed-${editingRoom.id}-${Date.now()}-${i + 1}`,
          roomId: editingRoom.id,
          bedNumber: `B${i + 1}`,
          status: 'Available',
        });
      }
    } else if (editCapacity < existingBeds.length) {
      // Check if any beds beyond the new capacity are occupied
      const occupiedBeyond = existingBeds.slice(editCapacity).filter((b) => b.status === 'Occupied');
      if (occupiedBeyond.length > 0) {
        alert(
          `Cannot reduce capacity to ${editCapacity}. Bed(s) ${occupiedBeyond
            .map((b) => `${b.bedNumber} (${b.residentName || 'Occupied'})`)
            .join(', ')} currently have active residents. Please reassign or checkout resident(s) before reducing bed capacity.`
        );
        return;
      }
      // Safe to trim unoccupied beds
      updatedBeds = existingBeds.slice(0, editCapacity);
    }

    editRoom(editingRoom.id, {
      buildingId: editBuildingId,
      floorId: finalFloorId,
      roomNumber: editRoomNumber.trim(),
      sharingType: editSharingType,
      capacity: editCapacity,
      baseRent: Number(editBaseRent),
      status: editRoomStatus,
      beds: updatedBeds,
    });

    setEditingRoom(null);
  };

  const handleDeleteRoomRequested = (room: Room) => {
    const hasOccupants = room.beds?.some((b) => b.status === 'Occupied');
    if (hasOccupants) {
      const occupiedBeds = room.beds.filter((b) => b.status === 'Occupied');
      alert(
        `Cannot delete Room ${room.roomNumber} because it has active residents in Bed(s): ${occupiedBeds
          .map((b) => `${b.bedNumber} (${b.residentName || 'Resident'})`)
          .join(', ')}.\n\nPlease reassign or checkout residents from this room before deleting it.`
      );
      return;
    }
    triggerProtectedAction(() => {
      setRoomToDelete(room);
    });
  };

  const handleDeleteRoomConfirmed = () => {
    if (!roomToDelete) return;
    const targetRoomId = roomToDelete.id;
    const success = deleteRoom(targetRoomId);
    if (success) {
      setRoomToDelete(null);
      if (editingRoom?.id === targetRoomId) {
        setEditingRoom(null);
      }
    } else {
      alert('Failed to delete room. Please make sure all beds in the room are vacated.');
    }
  };

  const handleRoomNumberChange = (val: string) => {
    setNewRoomNumber(val);
    const clean = val.trim();
    if (!clean) return;

    if (/^g/i.test(clean)) {
      setSelectedFloorName('Ground Floor');
    } else {
      const match = clean.match(/^(\d)/);
      if (match) {
        const floorDigit = match[1];
        if (floorDigit === '1') setSelectedFloorName('1st Floor');
        else if (floorDigit === '2') setSelectedFloorName('2nd Floor');
        else if (floorDigit === '3') setSelectedFloorName('3rd Floor');
        else if (floorDigit === '4') setSelectedFloorName('4th Floor');
        else if (floorDigit === '5') setSelectedFloorName('5th Floor');
        else if (floorDigit === '6') setSelectedFloorName('6th Floor');
      }
    }
  };

  // Helper to get or create floor ID
  const resolveFloorId = (buildingId: string, floorName: string): string => {
    const cleanName = floorName.trim();
    const existing = floors.find(
      (f) => f.buildingId === buildingId && f.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) return existing.id;
    return addFloor(buildingId, cleanName);
  };

  // New building form
  const [newBuildingName, setNewBuildingName] = useState<string>('');
  const [newBuildingDesc, setNewBuildingDesc] = useState<string>('');

  // New floor form
  const [targetBuildingForFloor, setTargetBuildingForFloor] = useState<string>(buildings[0]?.id || '');
  const [newFloorName, setNewFloorName] = useState<string>('');

  // Bed status modal
  const [selectedBedForStatus, setSelectedBedForStatus] = useState<{
    bedId: string;
    bedNumber: string;
    roomNumber: string;
    currentStatus: BedStatus;
    residentName?: string;
  } | null>(null);

  const filteredRooms = rooms.filter((room) => {
    if (selectedBuildingId !== 'ALL' && room.buildingId !== selectedBuildingId) return false;
    if (selectedFloorId !== 'ALL') {
      const roomFloorName = getRoomFloorName(room.floorId);
      if (roomFloorName.toLowerCase() !== selectedFloorId.toLowerCase()) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRoom = room.roomNumber.toLowerCase().includes(q);
      const matchBed = room.beds.some((b) => b.bedNumber.toLowerCase().includes(q) || (b.residentName && b.residentName.toLowerCase().includes(q)));
      if (!matchRoom && !matchBed) return false;
    }
    if (statusFilter === 'AVAILABLE' && !room.beds.some((b) => b.status === 'Available')) return false;
    if (statusFilter === 'OCCUPIED' && !room.beds.some((b) => b.status === 'Occupied')) return false;
    if (statusFilter === 'MAINTENANCE' && !room.beds.some((b) => b.status === 'Maintenance')) return false;
    return true;
  });

  // Calculate totals
  const allBeds = rooms.flatMap((r) => r.beds);
  const totalBeds = allBeds.length;
  const availableBeds = allBeds.filter((b) => b.status === 'Available').length;
  const occupiedBeds = allBeds.filter((b) => b.status === 'Occupied').length;
  const maintenanceBeds = allBeds.filter((b) => b.status === 'Maintenance').length;

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber || !newBuildingId) return;

    const floorName = selectedFloorName === 'Custom Floor' ? customFloorName.trim() || 'Extra Floor' : selectedFloorName;
    const finalFloorId = resolveFloorId(newBuildingId, floorName);

    addRoom(newBuildingId, finalFloorId, newRoomNumber, newSharingType, newCapacity, newBaseRent);
    setShowAddRoomModal(false);

    // Auto calculate next logical room number
    const numMatch = newRoomNumber.match(/(\d+)$/);
    if (numMatch) {
      const nextNum = parseInt(numMatch[1], 10) + 1;
      const prefix = newRoomNumber.slice(0, newRoomNumber.length - numMatch[1].length);
      setNewRoomNumber(`${prefix}${nextNum}`);
    } else {
      setNewRoomNumber('');
    }
  };

  const handleCreateBuilding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuildingName) return;
    addBuilding(newBuildingName, newBuildingDesc);
    setShowAddBuildingModal(false);
    setNewBuildingName('');
    setNewBuildingDesc('');
  };

  const handleCreateFloor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFloorName || !targetBuildingForFloor) return;
    addFloor(targetBuildingForFloor, newFloorName);
    setShowAddFloorModal(false);
    setNewFloorName('');
  };

  const updateNewCapacity = (newCap: number) => {
    const clamped = Math.max(0, newCap);
    setNewCapacity(clamped);
    setNewSharingType(getSharingTypeFromCapacity(clamped));
  };

  const handleSharingChange = (type: SharingType) => {
    setNewSharingType(type);
    if (type === 'Single') setNewCapacity(1);
    else if (type === '2-Sharing') setNewCapacity(2);
    else if (type === '3-Sharing') setNewCapacity(3);
    else if (type === '4-Sharing') setNewCapacity(4);
  };

  const handleDeleteBuildingRequested = (bld: Building) => {
    setBuildingToDelete(bld);
  };

  const handleDeleteBuildingConfirmed = async () => {
    if (!buildingToDelete) return;
    const bld = buildingToDelete;
    triggerProtectedAction(async () => {
      const res = await deleteBuilding(bld.id, true);
      if (res.success) {
        if (selectedBuildingId === bld.id) {
          setSelectedBuildingId('ALL');
        }
        setBuildingToDelete(null);
      } else {
        alert(res.error || 'Failed to delete building');
      }
    });
  };

  return (
    <div id="rooms-view-container" className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Rooms & Beds
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage allocations, rooms, and building configurations
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            id="add-room-btn"
            onClick={() => {
              setNewBuildingId(buildings[0]?.id || '');
              setSelectedFloorName('Ground Floor');
              setShowAddRoomModal(true);
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Room</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Building Filter Pills matching screenshot */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <input
              id="room-search-input"
              type="text"
              placeholder="Search rooms..."
              value={searchQuery || ''}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          </div>

          {/* Building Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => {
                setSelectedBuildingId('ALL');
                setSelectedFloorId('ALL');
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                selectedBuildingId === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              All Buildings
            </button>
            {buildings.map((b) => {
              const isSelected = selectedBuildingId === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    setSelectedBuildingId(b.id);
                    setSelectedFloorId('ALL');
                  }}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{b.name}</span>
                </button>
              );
            })}
            <button
              onClick={() => setShowAddBuildingModal(true)}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition flex items-center gap-1.5"
              title="Manage Buildings & Floors"
            >
              <Layers className="w-4 h-4" />
              <span className="text-xs font-semibold hidden md:inline">Buildings</span>
            </button>
          </div>
        </div>

        {/* Floor Filter Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
          <span className="text-slate-400 font-medium mr-1 text-[11px]">Floors:</span>
          <button
            key="ALL"
            onClick={() => setSelectedFloorId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
              selectedFloorId === 'ALL'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            All Floors
          </button>
          {Array.from(
            new Map(
              (selectedBuildingId === 'ALL'
                ? floors
                : floors.filter((f) => f.buildingId === selectedBuildingId)
              )
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((f) => [f.name, f])
            ).values()
          ).map((floor) => (
            <button
              key={floor.name}
              onClick={() => setSelectedFloorId(floor.name)} // using name as the filter value
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                selectedFloorId === floor.name
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              {floor.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bed Status Legend */}
      <div className="flex items-center gap-5 text-xs font-medium text-slate-600 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Available</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span>Occupied</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          <span>Maintenance</span>
        </span>
      </div>

      {/* Room Visual Grid */}
      {filteredRooms.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
          <BedDouble className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 mb-1">No Rooms Match Filter</h3>
          <p className="text-xs text-slate-500 mb-4">Try changing the building or floor filter.</p>
          <button
            onClick={() => {
              setSelectedBuildingId('ALL');
              setSelectedFloorId('ALL');
              setStatusFilter('ALL');
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => {
            const building = buildings.find((b) => b.id === room.buildingId);
            const displayFloorName = getRoomFloorName(room.floorId);
            const occupiedInRoom = room.beds.filter((b) => b.status === 'Occupied').length;
            const availableInRoom = room.beds.filter((b) => b.status === 'Available').length;

            return (
              <div
                key={room.id}
                id={`room-card-${room.roomNumber}`}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-blue-200 transition flex flex-col justify-between"
              >
                {/* Room Header */}
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Room {room.roomNumber}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {building?.name || 'Building A'} • {displayFloorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {room.sharingType}
                      </span>
                      <button
                        id={`edit-room-btn-${room.roomNumber}`}
                        onClick={() => openEditRoom(room)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit Room (Number, Sharing, Rent, Beds)"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Bed list matching screenshot */}
                  <div className="flex items-center gap-3.5 flex-wrap my-6">
                    {room.beds.map((bed) => {
                      const isOccupied = bed.status === 'Occupied';
                      const isMaintenance = bed.status === 'Maintenance';
                      const dotColor = isOccupied ? 'bg-rose-500' : isMaintenance ? 'bg-amber-400' : 'bg-emerald-500';

                      return (
                        <div
                          key={bed.id}
                          id={`bed-${bed.id}`}
                          onClick={() => {
                            if (isOccupied && bed.residentId) {
                              setSelectedResidentId(bed.residentId);
                              setActiveView('residents');
                            } else {
                              setSelectedBedForStatus({
                                bedId: bed.id,
                                bedNumber: bed.bedNumber,
                                roomNumber: room.roomNumber,
                                currentStatus: bed.status,
                                residentName: bed.residentName,
                              });
                            }
                          }}
                          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition py-0.5"
                          title={
                            isOccupied
                              ? `${bed.bedNumber}: Occupied by ${bed.residentName || 'Resident'} (Click to view resident details)`
                              : `${bed.bedNumber}: ${bed.status} (Click to change)`
                          }
                        >
                          <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                          <span className="text-xs font-semibold text-slate-800">{bed.bedNumber}</span>
                          {bed.residentName && (
                            <span className="text-[11px] text-slate-500 hover:text-blue-600 max-w-[80px] truncate">
                              ({bed.residentName.split(' ')[0]})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer matching screenshot */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600">
                    {availableInRoom} Available
                  </span>
                  <span className="font-semibold text-slate-900">
                    {occupiedInRoom} Occupied
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bed Status Toggle Modal */}
      {selectedBedForStatus && (
        <div
          id="bed-status-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setSelectedBedForStatus(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Room {selectedBedForStatus.roomNumber} • Bed {selectedBedForStatus.bedNumber}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Current Status:{' '}
              <span className="font-semibold text-slate-800">{selectedBedForStatus.currentStatus}</span>
              {selectedBedForStatus.residentName && ` (${selectedBedForStatus.residentName})`}
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  updateBedStatus(selectedBedForStatus.bedId, 'Available');
                  setSelectedBedForStatus(null);
                }}
                className="w-full p-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                  <span>Set Available</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => {
                  updateBedStatus(selectedBedForStatus.bedId, 'Maintenance');
                  setSelectedBedForStatus(null);
                }}
                className="w-full p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                  <span>Set Maintenance</span>
                </div>
                <Wrench className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Room Modal */}
      {showAddRoomModal && (
        <div
          id="add-room-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setShowAddRoomModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">Add New Room</h3>
            <p className="text-xs text-slate-500 mb-4">Define building, floor, room number and sharing</p>

            <form onSubmit={handleCreateRoom} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Building</label>
                  <select
                    value={newBuildingId}
                    onChange={(e) => setNewBuildingId(e.target.value)}
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
                    value={selectedFloorName}
                    onChange={(e) => setSelectedFloorName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                  >
                    {STANDARD_FLOORS.map((flr) => (
                      <option key={flr} value={flr}>
                        {flr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedFloorName === 'Custom Floor' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Custom Floor Name</label>
                  <input
                    required
                    placeholder="e.g. Terrace Floor, Basement, Attic"
                    value={customFloorName}
                    onChange={(e) => setCustomFloorName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Room Number / Name</label>
                <input
                  required
                  placeholder="e.g. 101, 204, G-02, 301"
                  value={newRoomNumber}
                  onChange={(e) => handleRoomNumberChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Floor is automatically detected based on room number (e.g. 101 → 1st Floor, 201 → 2nd Floor).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Sharing Type</label>
                  <select
                    value={newSharingType}
                    onChange={(e) => handleSharingChange(e.target.value as SharingType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="Single">Single Sharing (1 Bed)</option>
                    <option value="2-Sharing">2-Sharing (2 Beds)</option>
                    <option value="3-Sharing">3-Sharing (3 Beds)</option>
                    <option value="4-Sharing">4-Sharing (4 Beds)</option>
                    <option value="Custom">Custom Sharing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Total Beds (Capacity)</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateNewCapacity(Math.max(1, (newCapacity || 1) - 1))}
                      className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-bold rounded-lg text-sm transition shadow-2xs cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={newCapacity === 0 ? '' : newCapacity}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateNewCapacity(val === '' ? 0 : Math.max(0, parseInt(val) || 0));
                      }}
                      className="w-full text-center px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => updateNewCapacity((newCapacity || 0) + 1)}
                      className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-bold rounded-lg text-sm transition shadow-2xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Base Monthly Rent (₹)</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={newBaseRent === 0 ? '' : newBaseRent}
                  onChange={(e) => setNewBaseRent(e.target.value === '' ? 0 : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddRoomModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs"
                >
                  Create Room & Beds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Buildings & Floors Modal */}
      {showAddBuildingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAddBuildingModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-slate-900 mb-1">Manage Buildings & Wings</h3>
            <p className="text-xs text-slate-500 mb-4">View existing buildings or add a new building wing</p>

            {/* List of existing buildings */}
            <div className="space-y-2 mb-6">
              <label className="block text-xs font-bold text-slate-700">Existing Buildings ({buildings.length})</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {buildings.map((bld) => {
                  const bRooms = rooms.filter((r) => r.buildingId === bld.id);
                  const bFloors = floors.filter((f) => f.buildingId === bld.id);
                  return (
                    <div
                      key={bld.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">{bld.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {bFloors.length} Floors • {bRooms.length} Rooms
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddBuildingModal(false);
                          handleDeleteBuildingRequested(bld);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete Building</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add New Building Form */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-3">Add New Building Wing</h4>
              <form onSubmit={handleCreateBuilding} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Building Name</label>
                  <input
                    required
                    placeholder="e.g. Building C, South Wing, Annex"
                    value={newBuildingName}
                    onChange={(e) => setNewBuildingName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Description (Optional)</label>
                  <input
                    placeholder="e.g. 3 Floors, Premium Executive"
                    value={newBuildingDesc}
                    onChange={(e) => setNewBuildingDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddBuildingModal(false)}
                    className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl"
                  >
                    Save Building
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Building Confirmation Modal */}
      {buildingToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Delete {buildingToDelete.name}?
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              This will permanently delete <strong>{buildingToDelete.name}</strong> along with its assigned floors and rooms. Security PIN verification is required.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBuildingToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBuildingConfirmed}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Verify PIN & Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Floor Modal */}
      {showAddFloorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setShowAddFloorModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-slate-900 mb-3">Add Floor</h3>
            <form onSubmit={handleCreateFloor} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Building</label>
                <select
                  value={targetBuildingForFloor}
                  onChange={(e) => setTargetBuildingForFloor(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Floor Name</label>
                <input
                  required
                  placeholder="e.g. Floor 3, Third Floor, Terrace"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddFloorModal(false)}
                  className="px-4 py-2 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl"
                >
                  Save Floor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      {editingRoom && (
        <div
          id="edit-room-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingRoom(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Edit2 className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Edit Room {editingRoom.roomNumber}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Modify room number, building wing, floor, sharing type, capacity and rent
            </p>

            <form onSubmit={handleSaveEditRoom} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Building Wing</label>
                  <select
                    value={editBuildingId}
                    onChange={(e) => setEditBuildingId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Floor</label>
                  <select
                    value={editFloorName}
                    onChange={(e) => setEditFloorName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  >
                    {STANDARD_FLOORS.map((flr) => (
                      <option key={flr} value={flr}>
                        {flr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {editFloorName === 'Custom Floor' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Floor Name</label>
                  <input
                    required
                    placeholder="e.g. Penthouse, Basement, Terrace"
                    value={editCustomFloorName}
                    onChange={(e) => setEditCustomFloorName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Room Number / Label <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    placeholder="e.g. 101, 204, G-01"
                    value={editRoomNumber}
                    onChange={(e) => setEditRoomNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Room Status</label>
                  <select
                    value={editRoomStatus}
                    onChange={(e) => setEditRoomStatus(e.target.value as 'Active' | 'Maintenance')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white"
                  >
                    <option value="Active">Active / Operational</option>
                    <option value="Maintenance">Under Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sharing Type</label>
                  <select
                    value={editSharingType}
                    onChange={(e) => handleEditSharingChange(e.target.value as SharingType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white"
                  >
                    <option value="Single">Single Sharing</option>
                    <option value="2-Sharing">2-Sharing</option>
                    <option value="3-Sharing">3-Sharing</option>
                    <option value="4-Sharing">4-Sharing</option>
                    <option value="Custom">Custom Sharing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Bed Capacity</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateEditCapacity(Math.max(1, (editCapacity || 1) - 1))}
                      className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-bold rounded-lg text-sm transition shadow-2xs cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={editCapacity === 0 ? '' : editCapacity}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateEditCapacity(val === '' ? 0 : Math.max(0, parseInt(val) || 0));
                      }}
                      className="w-full text-center px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => updateEditCapacity((editCapacity || 0) + 1)}
                      className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-bold rounded-lg text-sm transition shadow-2xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Rent (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={editBaseRent === 0 ? '' : editBaseRent}
                    onChange={(e) => setEditBaseRent(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white"
                  />
                </div>
              </div>

              {/* Current Beds & Occupancy State */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                <label className="block text-[11px] font-bold text-slate-600 mb-2 uppercase tracking-wide">
                  Bed Allocation & Status Preview ({editCapacity} Beds)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Array.from({ length: editCapacity }).map((_, idx) => {
                    const existingBed = editingRoom.beds?.[idx];
                    const isOccupied = existingBed?.status === 'Occupied';
                    const isNew = !existingBed;

                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border text-xs flex flex-col ${
                          isOccupied
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : isNew
                            ? 'bg-blue-50 border-blue-200 text-blue-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        <span className="font-bold">Bed B{idx + 1}</span>
                        <span className="text-[10px] mt-0.5 truncate">
                          {isOccupied
                            ? existingBed.residentName || 'Occupied'
                            : isNew
                            ? 'New Bed'
                            : existingBed.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoom(null);
                    handleDeleteRoomRequested(editingRoom);
                  }}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 hover:border-rose-300 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Room</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRoom(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Room Confirmation Modal */}
      {roomToDelete && (
        <div
          id="delete-room-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Delete Room {roomToDelete.roomNumber}?
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Are you sure you want to permanently delete <strong>Room {roomToDelete.roomNumber}</strong> ({roomToDelete.sharingType}, {roomToDelete.beds?.length || roomToDelete.capacity} beds)? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoomToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRoomConfirmed}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sensitive Edit Passcode Protection Modal */}
      <SensitiveEditModal
        isOpen={showSensitiveEditModal}
        onClose={() => {
          setShowSensitiveEditModal(false);
          setPendingAction(null);
        }}
        onVerified={() => {
          if (pendingAction) pendingAction();
          setPendingAction(null);
        }}
      />
    </div>
  );
};
