import { BuildingModel, FloorModel, RoomModel, ResidentModel, ApplicationModel, PaymentModel, NotificationModel } from './server/models.js';
import { connectToDatabase } from './server/db.js';
import dotenv from 'dotenv';

dotenv.config();

connectToDatabase().then(async () => {
  console.log('1. Wiping all Firebase collections...');
  await BuildingModel.deleteMany({});
  await FloorModel.deleteMany({});
  await RoomModel.deleteMany({});
  await ResidentModel.deleteMany({});
  await ApplicationModel.deleteMany({});
  await PaymentModel.deleteMany({});
  await NotificationModel.deleteMany({});

  console.log('2. Inserting exact requested test data...');
  
  // Building A
  await BuildingModel.create({
    id: 'bld-test-A',
    name: 'Building A',
    description: 'Test Building A'
  });

  // Floors
  await FloorModel.create([
    { id: 'flr-test-g', buildingId: 'bld-test-A', name: 'Ground Floor', order: 0 },
    { id: 'flr-test-1', buildingId: 'bld-test-A', name: 'First Floor', order: 1 }
  ]);

  // Rooms and Beds
  await RoomModel.create([
    {
      id: 'rm-test-101',
      buildingId: 'bld-test-A',
      floorId: 'flr-test-g',
      roomNumber: '101',
      sharingType: '2-Sharing',
      capacity: 2,
      baseRent: 8500,
      status: 'Active',
      beds: [
        { id: 'bed-101-A', roomId: 'rm-test-101', bedNumber: '101-A', status: 'Available' },
        { id: 'bed-101-B', roomId: 'rm-test-101', bedNumber: '101-B', status: 'Available' }
      ]
    },
    {
      id: 'rm-test-102',
      buildingId: 'bld-test-A',
      floorId: 'flr-test-g',
      roomNumber: '102',
      sharingType: '2-Sharing',
      capacity: 2,
      baseRent: 8500,
      status: 'Active',
      beds: [
        { id: 'bed-102-A', roomId: 'rm-test-102', bedNumber: '102-A', status: 'Available' },
        { id: 'bed-102-B', roomId: 'rm-test-102', bedNumber: '102-B', status: 'Available' }
      ]
    },
    {
      id: 'rm-test-201',
      buildingId: 'bld-test-A',
      floorId: 'flr-test-1',
      roomNumber: '201',
      sharingType: '2-Sharing',
      capacity: 2,
      baseRent: 8500,
      status: 'Active',
      beds: [
        { id: 'bed-201-A', roomId: 'rm-test-201', bedNumber: '201-A', status: 'Available' },
        { id: 'bed-201-B', roomId: 'rm-test-201', bedNumber: '201-B', status: 'Available' }
      ]
    }
  ]);

  console.log('3. Test Data Seeding Complete!');
  process.exit(0);
}).catch(console.error);
