import { Entity, Index, JoinColumn, Column, ManyToOne, PrimaryColumn } from 'typeorm';
import { id } from '../id.js';
import { Note } from './note.js';
import { Antenna } from './antenna.js';

@Entity()
@Index(['noteId', 'antennaId'], { unique: true })
export class AntennaNote {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The note ID.',
	})
	public noteId: Note['id'];

	@ManyToOne(() => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public note: Note | null;

	@Index()
	@Column({
		...id(),
		comment: 'The antenna ID.',
	})
	public antennaId: Antenna['id'];

	@ManyToOne(() => Antenna, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public antenna: Antenna | null;

	@Index()
	@Column('boolean', {
		default: false,
	})
	public read: boolean;
}
