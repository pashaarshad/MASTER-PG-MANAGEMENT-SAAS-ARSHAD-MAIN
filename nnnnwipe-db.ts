import { 
  SettingModel, BuildingModel, FloorModel, RoomModel, 
  ResidentModel, ApplicationModel, PaymentModel, RuleModel, 
  NotificationModel, AuditLogModel, InvitationModel, StorageFileModel 
} from './server/models.js';
import { connectToDatabase } from './server/db.js';

async function wipeDatabase() {
  console.log('Connecting to Firebase...');
  await connectToDatabase();
  console.log('Connected! Wiping all collections...');

  await SettingModel.deleteMany({});
  await BuildingModel.deleteMany({});
  await FloorModel.deleteMany({});
  await RoomModel.deleteMany({});
  await ResidentModel.deleteMany({});
  await ApplicationModel.deleteMany({});
  await PaymentModel.deleteMany({});
  await RuleModel.deleteMany({});
  await NotificationModel.deleteMany({});
  await AuditLogModel.deleteMany({});
  await InvitationModel.deleteMany({});
  await StorageFileModel.deleteMany({});

  console.log('Database wiped completely. All collections are now empty.');
  process.exit(0);
}

wipeDatabase().catch(err => {
  console.error(err);
  process.exit(1);
});
