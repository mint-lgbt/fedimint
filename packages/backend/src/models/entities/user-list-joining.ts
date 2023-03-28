import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';
import { UserList } from './user-list.js';

@Entity()
@Index(['userId', 'userListId'], { unique: true })
export class UserListJoining {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the UserListJoining.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The user ID.',
	})
	public userId: User['id'];

	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column({
		...id(),
		comment: 'The list ID.',
	})
	public userListId: UserList['id'];

	@ManyToOne(() => UserList, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public userList: UserList | null;
}
